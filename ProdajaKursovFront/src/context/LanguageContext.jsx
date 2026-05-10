import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage должен использоваться внутри LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('classroom-language');
    return saved || 'ru';
  });

  useEffect(() => {
    localStorage.setItem('classroom-language', language);
  }, [language]);

  const changeLanguage = (newLanguage) => {
    setLanguage(newLanguage);
  };

  const translations = {
    ru: {
      'overview': 'Обзор',
      'my_courses': 'Мои курсы',
      'recent': 'Недавнее',
      'settings': 'Настройки',
      'create_course': 'Создать курс',
      'sign_out': 'Выйти',
    },
    en: {
      'overview': 'Overview',
      'my_courses': 'My Courses',
      'recent': 'Recent',
      'settings': 'Settings',
      'create_course': 'Create Course',
      'sign_out': 'Sign Out',
    }
  };

  const t = (key) => translations[language][key] || key;

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
