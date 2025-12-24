import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './FeatureSection.css';

const FeatureSection = ({
  title,
  subtitle,
  description,
  features = [],
  imagePosition = 'right', // 'left' or 'right'
  imageComponent,
  ctaText = '지금 시작하기',
  ctaPath = '/login',
}) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const currentSection = sectionRef.current;
    if (!currentSection) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            // 한 번만 트리거되도록 observer 해제
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.2, // 20% 보일 때 트리거
        rootMargin: '0px 0px -100px 0px', // 하단 100px 전에 트리거
      }
    );

    observer.observe(currentSection);

    return () => {
      observer.unobserve(currentSection);
    };
  }, []);

  const handleCTA = () => {
    if (isAuthenticated) {
      navigate('/');
    } else {
      navigate(ctaPath);
    }
  };

  return (
    <section
      ref={sectionRef}
      className={`feature-section ${
        imagePosition === 'left' ? 'image-left' : 'image-right'
      } ${isVisible ? 'visible' : ''}`}
    >
      <div className="feature-section-container">
        <div className="feature-content-wrapper">
          <div className="feature-text">
            <h2 className="feature-title">{title}</h2>
            {subtitle && <h3 className="feature-subtitle">{subtitle}</h3>}
            <p className="feature-description">{description}</p>

            {features.length > 0 && (
              <ul className="feature-list">
                {features.map((feature, index) => (
                  <li
                    key={index}
                    className="feature-item"
                    style={{
                      animationDelay: `${index * 0.1}s`,
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible
                        ? 'translateX(0)'
                        : 'translateX(-20px)',
                      transition: `opacity 0.6s ease ${
                        index * 0.1
                      }s, transform 0.6s ease ${index * 0.1}s`,
                    }}
                  >
                    <span className="feature-icon">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            )}

            {!isAuthenticated && (
              <button
                className="feature-cta"
                onClick={handleCTA}
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                  transition: `opacity 0.6s ease 0.4s, transform 0.6s ease 0.4s`,
                }}
              >
                {ctaText}
              </button>
            )}
          </div>

          <div className="feature-image">{imageComponent}</div>
        </div>
      </div>
    </section>
  );
};

export default FeatureSection;
