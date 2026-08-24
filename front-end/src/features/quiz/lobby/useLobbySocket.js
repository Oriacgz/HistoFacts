import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useLobbySocket
 * Manages resilient WebSocket connection for Kahoot-style quiz rooms.
 * Handles auto-reconnect, state restoration, server-authoritative timer, and participant updates.
 */
export function useLobbySocket({ code, user, role = 'player' }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [roomState, setRoomState] = useState('waiting_room'); // 'waiting_room' | 'question_active' | 'mini_leaderboard' | 'final_results'
  const [hostName, setHostName] = useState('Host');
  const [topic, setTopic] = useState('History Trivia');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(20);
  const [participants, setParticipants] = useState([]);
  const [miniLeaderboard, setMiniLeaderboard] = useState([]);
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);
  const [myAnswerResult, setMyAnswerResult] = useState(null);
  const [hasAnsweredCurrent, setHasAnsweredCurrent] = useState(false);

  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isUnmountedRef = useRef(false);

  const getWsUrl = useCallback(() => {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    // Connect through standard API Gateway
    const port = import.meta.env.VITE_GATEWAY_WS_PORT || (loc.port === '5173' || loc.port === '3000' ? '8000' : loc.port);
    const portSegment = port ? `:${port}` : '';
    const token = localStorage.getItem('access_token');
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${protocol}//${loc.hostname}${portSegment}/api/quiz/ws/lobby/${code}${tokenParam}`;
  }, [code]);

  const sendEvent = useCallback((type, payload = {}) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  const connect = useCallback(() => {
    if (!code || isUnmountedRef.current) return;

    const url = getWsUrl();
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setIsReconnecting(false);

      // Authenticate / Join room on connect or reconnect
      const token = localStorage.getItem('access_token');
      const userId = user?.id || `anon-${Math.random().toString(36).substring(2, 8)}`;
      const username = user?.username || 'Scholar';
      const tag = user?.tag || '0001';

      ws.send(JSON.stringify({
        type: 'join',
        token,
        user_id: userId,
        username,
        tag,
        role,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'room_state':
            setRoomState(msg.state || 'waiting_room');
            setHostName(msg.host_name || 'Host');
            setTopic(msg.topic || 'History Trivia');
            setCurrentQuestionIndex(msg.current_question_index || 0);
            setTotalQuestions(msg.total_questions || 10);
            setTimeRemaining(msg.time_remaining || 20);
            if (msg.question) setCurrentQuestion(msg.question);
            if (msg.participants) setParticipants(msg.participants);
            if (msg.mini_leaderboard) setMiniLeaderboard(msg.mini_leaderboard);
            break;

          case 'participants_update':
            if (msg.participants) setParticipants(msg.participants);
            break;

          case 'question_start':
            setRoomState('question_active');
            setCurrentQuestionIndex(msg.index);
            setTotalQuestions(msg.total);
            setCurrentQuestion(msg.question);
            setTimeRemaining(msg.time_remaining || 20);
            setHasAnsweredCurrent(false);
            setMyAnswerResult(null);
            break;

          case 'time_sync':
            if (msg.time_remaining !== undefined) {
              setTimeRemaining(msg.time_remaining);
            }
            break;

          case 'answer_acknowledged':
            setHasAnsweredCurrent(true);
            setMyAnswerResult({
              is_correct: msg.is_correct,
              correct_answer: msg.correct_answer,
              score: msg.score,
            });
            break;

          case 'show_mini_leaderboard':
            setRoomState('mini_leaderboard');
            if (msg.mini_leaderboard) setMiniLeaderboard(msg.mini_leaderboard);
            break;

          case 'final_results':
            setRoomState('final_results');
            if (msg.leaderboard) setFinalLeaderboard(msg.leaderboard);
            break;

          default:
            break;
        }
      } catch (err) {
        console.warn('Malformed WS message:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (!isUnmountedRef.current) {
        setIsReconnecting(true);
        // Resilient silent reconnect after 1.5s
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 1500);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [code, user, role, getWsUrl]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [connect]);

  // Host Action: Start Quiz
  const startQuiz = useCallback(() => {
    sendEvent('start_quiz');
  }, [sendEvent]);

  // Host Action: Show Mini-Leaderboard
  const showMiniLeaderboard = useCallback(() => {
    sendEvent('show_leaderboard');
  }, [sendEvent]);

  // Host Action: Advance to Next Question
  const nextQuestion = useCallback(() => {
    sendEvent('next_question');
  }, [sendEvent]);

  // Player Action: Submit Answer
  const submitAnswer = useCallback((selectedOption) => {
    sendEvent('submit_answer', { selected_option: selectedOption });
  }, [sendEvent]);

  return {
    isConnected,
    isReconnecting,
    roomState,
    hostName,
    topic,
    currentQuestionIndex,
    totalQuestions,
    currentQuestion,
    timeRemaining,
    participants,
    miniLeaderboard,
    finalLeaderboard,
    myAnswerResult,
    hasAnsweredCurrent,
    startQuiz,
    showMiniLeaderboard,
    nextQuestion,
    submitAnswer,
  };
}