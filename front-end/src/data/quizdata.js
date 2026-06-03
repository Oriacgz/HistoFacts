export function generateQuizData(topic) {
  const normalizedTopic = topic.toLowerCase();
  let questions = [];

  if (normalizedTopic.includes('mughal')) {
    questions = [
      { question: 'Who was the founder of the Mughal Empire in India?', options: ['Akbar', 'Babur', 'Humayun', 'Aurangzeb'], correct_answer: 1 },
      { question: 'Which Mughal emperor built the Taj Mahal?', options: ['Shah Jahan', 'Akbar', 'Jahangir', 'Aurangzeb'], correct_answer: 0 },
      { question: "During which Mughal emperor's reign did the empire reach its greatest extent?", options: ['Babur', 'Humayun', 'Akbar', 'Aurangzeb'], correct_answer: 3 },
      { question: 'Which Mughal emperor introduced the policy of Din-i-Ilahi?', options: ['Jahangir', 'Akbar', 'Shah Jahan', 'Humayun'], correct_answer: 1 },
      { question: 'Who was the last powerful Mughal emperor?', options: ['Bahadur Shah Zafar', 'Aurangzeb', 'Shah Alam II', 'Muhammad Shah'], correct_answer: 1 },
      { question: 'The famous Peacock Throne was built during the reign of which Mughal emperor?', options: ['Akbar', 'Jahangir', 'Shah Jahan', 'Aurangzeb'], correct_answer: 2 },
      { question: "Which Mughal emperor wrote his autobiography 'Tuzuk-i-Jahangiri'?", options: ['Babur', 'Humayun', 'Akbar', 'Jahangir'], correct_answer: 3 },
      { question: 'The Battle of Panipat that established Mughal rule in India was fought in which year?', options: ['1526', '1556', '1576', '1600'], correct_answer: 0 },
      { question: 'Which Mughal emperor had the longest reign?', options: ['Akbar', 'Shah Jahan', 'Aurangzeb', 'Jahangir'], correct_answer: 2 },
      { question: 'Who was the court historian of Akbar?', options: ['Abul Fazl', 'Badauni', 'Faizi', 'Birbal'], correct_answer: 0 },
    ];
  } else if (normalizedTopic.includes('freedom') || normalizedTopic.includes('independence')) {
    questions = [
      { question: 'When was the Indian National Congress founded?', options: ['1885', '1905', '1920', '1857'], correct_answer: 0 },
      { question: "Who is known as the 'Father of the Nation' in India?", options: ['Jawaharlal Nehru', 'Sardar Patel', 'Mahatma Gandhi', 'Subhas Chandra Bose'], correct_answer: 2 },
      { question: 'Which movement was launched by Mahatma Gandhi in 1942?', options: ['Non-Cooperation Movement', 'Civil Disobedience Movement', 'Quit India Movement', 'Swadeshi Movement'], correct_answer: 2 },
      { question: 'Who formed the Indian National Army (Azad Hind Fauj)?', options: ['Bhagat Singh', 'Chandrashekhar Azad', 'Subhas Chandra Bose', 'Lala Lajpat Rai'], correct_answer: 2 },
      { question: 'The Jallianwala Bagh Massacre took place in which year?', options: ['1915', '1919', '1925', '1930'], correct_answer: 1 },
      { question: 'Who was the first woman president of the Indian National Congress?', options: ['Sarojini Naidu', 'Annie Besant', 'Vijaya Lakshmi Pandit', 'Aruna Asaf Ali'], correct_answer: 1 },
      { question: 'The Dandi March was associated with which movement?', options: ['Non-Cooperation Movement', 'Civil Disobedience Movement', 'Quit India Movement', 'Swadeshi Movement'], correct_answer: 1 },
      { question: 'Who founded the Hindustan Republican Association?', options: ['Bhagat Singh', 'Chandrashekhar Azad', 'Ram Prasad Bismil', 'Lala Hardayal'], correct_answer: 2 },
      { question: 'When did India gain independence from British rule?', options: ['August 15, 1945', 'January 26, 1950', 'August 15, 1947', 'January 30, 1948'], correct_answer: 2 },
      { question: 'Who was the last Viceroy of India?', options: ['Lord Mountbatten', 'Lord Wavell', 'Lord Linlithgow', 'Lord Irwin'], correct_answer: 0 },
    ];
  } else {
    questions = [
      { question: 'Which civilization flourished in the Indus Valley around 2500 BCE?', options: ['Vedic Civilization', 'Harappan Civilization', 'Mauryan Civilization', 'Gupta Civilization'], correct_answer: 1 },
      { question: 'The Battle of Plassey, which established British rule in India, was fought in which year?', options: ['1757', '1764', '1776', '1784'], correct_answer: 0 },
      { question: 'Who was the first woman ruler of Delhi?', options: ['Razia Sultan', 'Nur Jahan', 'Mumtaz Mahal', 'Jodha Bai'], correct_answer: 0 },
      { question: 'The ancient Indian university Nalanda was located in present-day:', options: ['Uttar Pradesh', 'Bihar', 'West Bengal', 'Madhya Pradesh'], correct_answer: 1 },
      { question: 'Which dynasty ruled over the Vijayanagara Empire?', options: ['Chola', 'Sangama', 'Pallava', 'Chalukya'], correct_answer: 1 },
      { question: 'The Revolt of 1857 started from which place?', options: ['Delhi', 'Kanpur', 'Jhansi', 'Meerut'], correct_answer: 3 },
      { question: 'Who was the founder of the Sikh religion?', options: ['Guru Nanak', 'Guru Gobind Singh', 'Guru Tegh Bahadur', 'Guru Arjan Dev'], correct_answer: 0 },
      { question: 'The Chola dynasty was primarily based in which part of India?', options: ['North India', 'South India', 'East India', 'West India'], correct_answer: 1 },
      { question: 'Who was the first Sultan of Delhi?', options: ['Qutb-ud-din Aibak', 'Iltutmish', 'Muhammad Ghori', 'Balban'], correct_answer: 0 },
      { question: 'The Ajanta Caves are primarily dedicated to which religion?', options: ['Hinduism', 'Buddhism', 'Jainism', 'Sikhism'], correct_answer: 1 },
    ];
  }

  return {
    id: Math.floor(Math.random() * 1000),
    topic,
    questions,
  };
}