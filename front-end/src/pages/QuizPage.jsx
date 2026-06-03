import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chart } from 'chart.js/auto';
import { generateQuizData } from '../data/quizData';
import {
  CheckCircleIcon,
  ChevronLeftIcon,
  RightArrowIcon,
  SearchIcon,
  TimeIcon,
  XCircleIcon,
} from '../components/MotionIcons';

const CIRCLE_STYLES = [
  { left: '25%', size: 80, delay: '0s', duration: '25s' },
  { left: '10%', size: 20, delay: '2s', duration: '12s' },
  { left: '70%', size: 20, delay: '4s', duration: '25s' },
  { left: '40%', size: 60, delay: '0s', duration: '18s' },
  { left: '65%', size: 20, delay: '0s', duration: '25s' },
  { left: '75%', size: 110, delay: '3s', duration: '25s' },
  { left: '35%', size: 150, delay: '7s', duration: '25s' },
  { left: '50%', size: 25, delay: '15s', duration: '45s' },
  { left: '20%', size: 15, delay: '2s', duration: '35s' },
  { left: '85%', size: 150, delay: '0s', duration: '11s' },
];

export default function QuizPage() {
  const [screen, setScreen] = useState('welcome');
  const [quizData, setQuizData] = useState({ id: null, topic: '', questions: [] });
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [quizStartTime, setQuizStartTime] = useState(0);
  const [quizEndTime, setQuizEndTime] = useState(0);
  const [timerText, setTimerText] = useState('00:00');
  const [errorMessage, setErrorMessage] = useState('');
  const [topic, setTopic] = useState('');
  const performanceChartRef = useRef(null);
  const timeChartRef = useRef(null);
  const chartInstancesRef = useRef([]);

  const totalQuestions = quizData.questions.length;
  const question = quizData.questions[currentQuestion];

  const showError = (message) => {
    setErrorMessage(message);
    window.setTimeout(() => setErrorMessage(''), 3000);
  };

  const generateQuiz = (value) => {
    const nextQuiz = generateQuizData(value);
    setQuizData(nextQuiz);
    setCurrentQuestion(0);
    setUserAnswers(Array(nextQuiz.questions.length).fill(null));
    setQuizStartTime(Date.now());
    setQuizEndTime(0);
    setScreen('quiz');
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const value = topic.trim();

    if (!value) {
      showError('Please enter a topic to search');
      return;
    }

    generateQuiz(value);
  };

  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((value) => value - 1);
    }
  };

  const handleNext = () => {
    if (userAnswers[currentQuestion] === null) {
      showError('Please select an answer');
      return;
    }

    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion((value) => value + 1);
      return;
    }

    setQuizEndTime(Date.now());
    setScreen('results');
  };

  const handleRetake = () => {
    setCurrentQuestion(0);
    setUserAnswers(Array(quizData.questions.length).fill(null));
    setQuizStartTime(Date.now());
    setQuizEndTime(0);
    setScreen('quiz');
  };

  useEffect(() => {
    if (screen !== 'quiz') {
      setTimerText('00:00');
      return undefined;
    }

    const updateTimer = () => {
      const elapsedTime = Math.floor((Date.now() - quizStartTime) / 1000);
      const minutes = String(Math.floor(elapsedTime / 60)).padStart(2, '0');
      const seconds = String(elapsedTime % 60).padStart(2, '0');
      setTimerText(`${minutes}:${seconds}`);
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);

    return () => window.clearInterval(interval);
  }, [screen, quizStartTime]);

  const totalTime = useMemo(() => {
    if (!quizStartTime || !quizEndTime) return 0;
    return Math.floor((quizEndTime - quizStartTime) / 1000);
  }, [quizStartTime, quizEndTime]);

  const score = useMemo(() => {
    return quizData.questions.reduce((count, item, index) => count + (userAnswers[index] === item.correct_answer ? 1 : 0), 0);
  }, [quizData.questions, userAnswers]);

  useEffect(() => {
    if (screen !== 'results') {
      return undefined;
    }

    chartInstancesRef.current.forEach((chart) => chart.destroy());
    chartInstancesRef.current = [];

    if (!performanceChartRef.current || !timeChartRef.current) return undefined;

    const performanceChart = new Chart(performanceChartRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Correct', 'Incorrect'],
        datasets: [
          {
            data: [score, quizData.questions.length - score],
            backgroundColor: ['rgba(16, 185, 129, 0.7)', 'rgba(239, 68, 68, 0.7)'],
            borderColor: ['rgba(16, 185, 129, 1)', 'rgba(239, 68, 68, 1)'],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Performance' },
          legend: { position: 'bottom' },
        },
      },
    });

    const averageTime = quizData.questions.length ? totalTime / quizData.questions.length : 0;
    const timeChart = new Chart(timeChartRef.current, {
      type: 'bar',
      data: {
        labels: ['Total Time', 'Avg. Time per Question'],
        datasets: [
          {
            label: 'Time (seconds)',
            data: [totalTime, averageTime.toFixed(1)],
            backgroundColor: ['rgba(79, 70, 229, 0.7)', 'rgba(79, 70, 229, 0.4)'],
            borderColor: ['rgba(79, 70, 229, 1)', 'rgba(79, 70, 229, 1)'],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
        plugins: {
          title: { display: true, text: 'Time Analysis' },
          legend: { display: false },
        },
      },
    });

    chartInstancesRef.current = [performanceChart, timeChart];

    return () => {
      chartInstancesRef.current.forEach((chart) => chart.destroy());
      chartInstancesRef.current = [];
    };
  }, [screen, score, totalTime, quizData.questions.length]);

  return (
    <div className="relative min-h-screen overflow-x-hidden font-ui text-[1rem] leading-6 text-[#1f2937]">
      <div className="fixed inset-0 -z-10 bg-[#4e54c8] bg-gradient-to-l from-[#8f94fb] to-[#4e54c8]" />
      <ul className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden">
        {CIRCLE_STYLES.map((circle, index) => (
          <li
            key={index}
            className="absolute bottom-[-150px] block list-none bg-white/20 animate-bubble"
            style={{
              left: circle.left,
              width: `${circle.size}px`,
              height: `${circle.size}px`,
              animationDelay: circle.delay,
              animationDuration: circle.duration,
            }}
          />
        ))}
      </ul>

      <div className="relative z-10 min-h-screen">
        <header className="fixed left-0 top-0 z-20 flex w-full items-center justify-between bg-black/40 px-[clamp(24px,6vw,100px)] py-5 text-white">
          <Link to="/" className="text-[32px] font-bold text-white">HistoFacts</Link>
          <nav className="flex gap-16 text-[18px] font-medium text-white">
            <Link to="/" className="relative after:absolute after:left-0 after:top-full after:h-[2px] after:w-0 after:bg-white after:transition-all after:duration-500 hover:after:w-full">Home</Link>
            <a href="#about" className="relative after:absolute after:left-0 after:top-full after:h-[2px] after:w-0 after:bg-white after:transition-all after:duration-500 hover:after:w-full">About</a>
            <a href="#help" className="relative after:absolute after:left-0 after:top-full after:h-[2px] after:w-0 after:bg-white after:transition-all after:duration-500 hover:after:w-full">Help</a>
          </nav>
        </header>

        <div className="mx-auto max-w-[800px] px-4 py-8 pt-28">
          {screen === 'welcome' ? (
            <section>
              <div className="mb-8 text-center text-white">
                <h1 className="mb-2 text-3xl font-light">Indian History Quiz</h1>
                <p>Test your knowledge of Indian history</p>
              </div>

              <div className="mb-6 rounded-histo bg-white p-6 shadow-[0_4px_6px_rgba(0,0,0,0.1)] animate-fade-in">
                <h2 className="mb-4 text-2xl font-semibold">Search for a Topic</h2>
                {errorMessage ? <div className="mb-4 rounded-histo bg-[rgba(239,68,68,0.1)] p-2 text-sm text-[#ef4444]">{errorMessage}</div> : null}
                <form onSubmit={handleSearchSubmit} className="space-y-4">
                  <input
                    type="text"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="Enter a topic in Indian history (e.g., Mughal Empire, Freedom Movement)"
                    className="w-full rounded-histo border border-[#e5e7eb] p-3 text-base outline-none transition focus:border-[#003d80] focus:ring-2 focus:ring-[#003d80]/10"
                  />
                  <button type="submit" className="inline-flex items-center justify-center rounded-histo bg-[#003d80] px-6 py-3 font-medium text-white transition hover:bg-[#151b54]">
                    <SearchIcon className="mr-2 h-4 w-4" /> Start Quiz
                  </button>
                </form>
              </div>
            </section>
          ) : null}

          {screen === 'quiz' && question ? (
            <section>
              <div className="mb-8 text-center text-white">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-medium">Topic: {quizData.topic}</h2>
                  <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#003d80]">Question {currentQuestion + 1} of {quizData.questions.length}</div>
                </div>
                <div className="mt-4 flex items-center font-medium text-white">
                  <TimeIcon className="mr-2 h-4 w-4" /> {timerText}
                </div>
              </div>

              <div className="rounded-histo bg-white p-6 shadow-[0_4px_6px_rgba(0,0,0,0.1)] animate-fade-in">
                <h3 className="mb-4 text-2xl font-semibold text-[#1f2937]">{question.question}</h3>

                <div className="mb-6 space-y-3">
                  {question.options.map((option, index) => {
                    const selected = userAnswers[currentQuestion] === index;

                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setUserAnswers((current) => {
                            const next = [...current];
                            next[currentQuestion] = index;
                            return next;
                          });
                        }}
                        className={`flex w-full items-center rounded-histo border p-3 text-left transition ${selected ? 'border-[#003d80] bg-[rgba(79,70,229,0.1)]' : 'border-[#e5e7eb] hover:border-[#003d80]'}`}
                      >
                        <span className={`mr-3 flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium ${selected ? 'bg-[#003d80] text-white' : 'bg-[#f3f4f6] text-[#1f2937]'}`}>{String.fromCharCode(65 + index)}</span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>

                {errorMessage ? <div className="mb-4 rounded-histo bg-[rgba(239,68,68,0.1)] p-2 text-sm text-[#ef4444]">{errorMessage}</div> : null}

                <div className="flex justify-between gap-4">
                  <button type="button" onClick={handlePrev} disabled={currentQuestion === 0} className="inline-flex items-center justify-center rounded-histo border border-[#e5e7eb] px-6 py-3 font-medium text-[#1f2937] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-50">
                    <ChevronLeftIcon className="mr-2 h-4 w-4" /> Previous
                  </button>
                  <button type="button" onClick={handleNext} className="inline-flex items-center justify-center rounded-histo bg-[#003d80] px-6 py-3 font-medium text-white transition hover:bg-[#151b54]">
                    {currentQuestion === quizData.questions.length - 1 ? 'Finish Quiz' : 'Next'} <RightArrowIcon className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {screen === 'results' ? (
            <section>
              <div className="mb-8 text-center text-white">
                <h1 className="mb-2 text-3xl font-light">Quiz Results</h1>
              </div>

              <div className="rounded-histo bg-white p-6 shadow-[0_4px_6px_rgba(0,0,0,0.1)] animate-fade-in">
                <div className="mb-8 flex flex-wrap items-center justify-around gap-6 rounded-histo bg-[#f9fafb] p-4">
                  <div className="text-center">
                    <div className="relative mx-auto flex h-[100px] w-[100px] items-center justify-center rounded-full bg-[#003d80] text-white">
                      <span className="text-[2.5rem] font-bold leading-none">{score}</span>
                      <span className="absolute bottom-4 right-4 text-base">/10</span>
                    </div>
                  </div>
                  <div className="flex items-center text-xl">
                    <TimeIcon className="mr-2 h-5 w-5 text-[#003d80]" /> Time: {formatTime(totalTime)}
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="mb-4 text-2xl font-semibold">Performance Statistics</h3>
                  <div className="flex flex-wrap gap-4">
                    <div className="min-h-[200px] flex-1 min-w-[250px] rounded-histo bg-[#f9fafb] p-4">
                      <canvas ref={performanceChartRef} />
                    </div>
                    <div className="min-h-[200px] flex-1 min-w-[250px] rounded-histo bg-[#f9fafb] p-4">
                      <canvas ref={timeChartRef} />
                    </div>
                  </div>
                </div>

                <h3 className="mb-4 text-2xl font-semibold">Review Your Answers</h3>
                <div className="mb-8 space-y-4">
                  {quizData.questions.map((item, index) => {
                    const isCorrect = userAnswers[index] === item.correct_answer;
                    const selectedIndex = userAnswers[index];

                    return (
                      <div key={item.question} className={`rounded-histo border p-4 ${isCorrect ? 'border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.1)]' : 'border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.1)]'}`}>
                        <div className="flex items-start gap-2">
                          <div className={`mt-1 ${isCorrect ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                            {isCorrect ? <CheckCircleIcon className="h-5 w-5" /> : <XCircleIcon className="h-5 w-5" />}
                          </div>
                          <div>
                            <p className="font-semibold"><strong>Q{index + 1}:</strong> {item.question}</p>
                            <p>You selected: {String.fromCharCode(65 + selectedIndex)} - {item.options[selectedIndex]}</p>
                            {!isCorrect ? <p className="mt-2 font-medium text-[#10b981]">Correct answer: {String.fromCharCode(65 + item.correct_answer)} - {item.options[item.correct_answer]}</p> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap justify-center gap-4">
                  <button type="button" onClick={handleRetake} className="min-w-[200px] flex-1 rounded-histo border border-[#e5e7eb] px-6 py-3 font-medium text-[#1f2937] transition hover:bg-[#f9fafb]">Retake Quiz (Same Questions)</button>
                  <Link to="/" className="min-w-[200px] flex-1 rounded-histo bg-[#003d80] px-6 py-3 text-center font-medium text-white transition hover:bg-[#151b54]">Home</Link>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatTime(timeInSeconds) {
  const minutes = String(Math.floor(timeInSeconds / 60)).padStart(2, '0');
  const seconds = String(timeInSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}