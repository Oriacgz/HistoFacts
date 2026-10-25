import { useEffect, useRef, useState, useCallback } from 'react';
import { endLobbyApi } from '../../../api/quiz';
import { API_BASE_URL } from '../../../api/client';

export function useLobbySocket({ code, user }) {
  const [state, setState] = useState({ roomState: 'waiting_room', participants: [], finalLeaderboard: [],
    timeRemaining: 0, totalQuestions: 10, currentQuestionIndex: -1, currentQuestion: null,
    hostName: 'Host', topic: 'History Trivia', currentUserId: null, myAnswerResult: null,
    endedByHost: false, hasAnsweredCurrent: false, role: null, result: null, scoringRules: null });
  const [errorMessage, setErrorMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const socketRef = useRef(null);
  const questionIdRef = useRef(null);

  useEffect(() => {
    if (!code) return;
    let stopped = false;
    let retryTimer;
    let attempts = 0;
    let version = -1;
    const connect = () => {
      const url = new URL(`${API_BASE_URL.replace(/\/$/, '')}/api/quiz/lobby/${code}/ws`);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      if (import.meta.env.VITE_GATEWAY_WS_PORT) url.port = import.meta.env.VITE_GATEWAY_WS_PORT;
      const ws = new WebSocket(url);
      socketRef.current = ws;
      ws.onopen = () => {
        if (stopped || socketRef.current !== ws) return;
        setErrorMessage('');
        ws.send(JSON.stringify({ action: 'join', token: localStorage.getItem('access_token'),
          username: user?.username, tag: user?.tag }));
      };
      ws.onmessage = (event) => {
        if (stopped || socketRef.current !== ws) return;
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'error') { setErrorMessage(message.message); return; }
          if (message.type !== 'room_state' || message.version < version) return;
          const changed = message.version > version;
          version = message.version;
          attempts = 0;
          setIsConnected(true);
          setIsReconnecting(false);
          if (changed) setErrorMessage('');
          questionIdRef.current = message.question?.id;
          setState({ endedByHost: Boolean(message.ended_by_host), role: message.role, roomState: message.state, hostName: message.host_name, topic: message.topic,
            currentUserId: message.user_id, currentQuestionIndex: message.current_question_index,
            totalQuestions: message.total_questions, currentQuestion: message.question,
            timeRemaining: message.time_remaining, participants: message.participants,
            finalLeaderboard: message.leaderboard, myAnswerResult: message.my_answer_result,
            hasAnsweredCurrent: Boolean(message.my_answer_result), result: message.result,
            scoringRules: message.scoring_rules, difficulty: message.difficulty });
        } catch { setErrorMessage('Could not read lobby update. Reconnect to resume.'); }
      };
      ws.onclose = (event) => {
        if (stopped || socketRef.current !== ws) return;
        setIsConnected(false);
        if (event.code === 4401) { setIsReconnecting(false); return; }
        setIsReconnecting(true);
        retryTimer = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 30000));
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      const ws = socketRef.current;
      socketRef.current = null;
      ws?.close();
      setIsConnected(false);
      setIsReconnecting(false);
    };
  }, [code, user?.username, user?.tag]);

  const send = useCallback((action, fields = {}) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action, ...fields }));
    }
  }, []);
  return { ...state, errorMessage, isConnected, isReconnecting,
    startQuiz: () => send('start_quiz'), showMiniLeaderboard: () => send('advance_question'),
    endQuiz: async () => {
      try { await endLobbyApi(code); }
      catch (error) { setErrorMessage(error.message || 'Could not end the quiz. Try again.'); }
    },
    nextQuestion: () => send('advance_question'),
    submitAnswer: (selectedOption) => send('submit_answer', { question_id: questionIdRef.current, selected_option: selectedOption }),
  };
}
