import React, { useState, useRef, useEffect } from 'react';
import  './App.css';

function App() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [typingStart, setTypingStart] = useState(null);
  const [typingEnd, setTypingEnd] = useState(null);
  const [language, setLanguage] = useState('en');
  const [darkMode, setDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  // Use environment variables for API keys
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'demo';
  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

  // Enhanced text analysis with better fallback
  const analyzeTextContent = (text) => {
    const textLower = text.toLowerCase();
    const words = textLower.split(/\s+/);
    const wordCount = words.length;
    
    // Emotion indicators with weights
    const emotionIndicators = {
      joy: { words: ['happy', 'joy', 'excited', 'great', 'wonderful', 'love', 'laugh', 'smile', 'fun', 'enjoy'], weight: 2 },
      sadness: { words: ['sad', 'unhappy', 'depressed', 'cry', 'tears', 'miss', 'grief', 'heartbreak', 'lonely'], weight: 2 },
      anger: { words: ['angry', 'mad', 'furious', 'hate', 'rage', 'annoyed', 'frustrated', 'outrage'], weight: 2 },
      fear: { words: ['scared', 'afraid', 'fear', 'anxious', 'worry', 'nervous', 'terrified', 'panic'], weight: 2 },
      surprise: { words: ['surprise', 'shock', 'amazed', 'astonished', 'unexpected', 'wow'], weight: 1.5 },
      love: { words: ['love', 'adore', 'care', 'affection', 'romance', 'passion', 'crush', 'cherish'], weight: 2 },
      neutral: { words: ['okay', 'fine', 'normal', 'regular', 'meh', 'whatever', 'neutral'], weight: 1 }
    };
    
    // Calculate emotion scores
    const emotions = {};
    let totalScore = 0;
    
    Object.keys(emotionIndicators).forEach(emotion => {
      let score = 0;
      emotionIndicators[emotion].words.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) score += matches.length * emotionIndicators[emotion].weight;
      });
      
      // Add base score for text length
      score += Math.min(10, wordCount / 10);
      
      emotions[emotion] = score;
      totalScore += score;
    });
    
    // Convert to percentages
    Object.keys(emotions).forEach(emotion => {
      emotions[emotion] = Math.min(100, Math.round((emotions[emotion] / totalScore) * 100));
    });
    
    // Ensure at least some neutral value if all else is low
    if (Object.values(emotions).filter(v => v > 10).length < 2) {
      emotions.neutral = Math.max(emotions.neutral, 30);
    }
    
    // Rebalance to ensure total is approximately 100
    const currentTotal = Object.values(emotions).reduce((sum, val) => sum + val, 0);
    const adjustmentFactor = 100 / currentTotal;
    Object.keys(emotions).forEach(emotion => {
      emotions[emotion] = Math.round(emotions[emotion] * adjustmentFactor);
    });
    
    // Find dominant emotion
    let dominantEmotion = 'neutral';
    let highestScore = 0;
    
    Object.entries(emotions).forEach(([emotion, score]) => {
      if (score > highestScore) {
        highestScore = score;
        dominantEmotion = emotion;
      }
    });
    
    // Sentiment analysis
    const positiveWords = ['happy', 'good', 'great', 'love', 'excited', 'joy', 'wonderful', 'nice', 'awesome', 'best'];
    const negativeWords = ['sad', 'bad', 'angry', 'hate', 'scared', 'fear', 'terrible', 'awful', 'horrible', 'worst'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) positiveCount += matches.length;
    });
    
    negativeWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) negativeCount += matches.length;
    });
    
    const totalWords = positiveCount + negativeCount || 1;
    const sentimentScore = Math.round(((positiveCount - negativeCount) / totalWords) * 100);
    
    let sentiment;
    if (sentimentScore > 20) sentiment = 'positive';
    else if (sentimentScore < -20) sentiment = 'negative';
    else sentiment = 'neutral';
    
    // Generate context-aware advice
    let advice = "Take a moment to reflect on your feelings. Consider talking to someone you trust.";
    
    if (textLower.includes('not well') || textLower.includes('not good') || textLower.includes('depressed')) {
      advice = "It sounds like you're going through a tough time. Remember that it's okay to not be okay. Consider reaching out to someone you trust or engaging in self-care activities.";
    } else if (positiveCount > negativeCount * 2) {
      advice = "It's great that you're feeling positive! Try to savor this moment and consider what brought you this happiness.";
    } else if (textLower.includes('angry') || textLower.includes('mad') || textLower.includes('frustrated')) {
      advice = "Anger is a natural emotion. Try to understand its source and channel it constructively. Physical activity can help release angry energy.";
    } else if (textLower.includes('scared') || textLower.includes('afraid') || textLower.includes('anxious')) {
      advice = "It's normal to feel fear sometimes. Try to identify what's causing these feelings and break it down into manageable steps. Deep breathing exercises can help.";
    }
    
    // Calculate additional aspects based on text content
    const stressLevel = Math.min(100, 10 + (negativeCount * 5) + (textLower.includes('stress') ? 20 : 0));
    const confidence = Math.min(100, 50 + (positiveCount * 3) - (negativeCount * 2));
    const energy = Math.min(100, 60 + (positiveCount * 2) - (negativeCount * 1));
    const socialTendency = Math.min(100, 50 + (textLower.includes('friend') || textLower.includes('family') || textLower.includes('we') ? 25 : 0));
    
    return {
      emotions,
      dominantEmotion,
      sentiment,
      sentimentScore,
      advice,
      additionalAspects: {
        stressLevel,
        confidence,
        energy,
        socialTendency
      }
    };
  };

  const analyzeWithGemini = async (text) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Try to use Gemini API if key is available
      if (GEMINI_API_KEY && GEMINI_API_KEY !== 'demo') {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Analyze the following text for emotions, sentiment, and provide advice. 
                Return your response as a valid JSON object with this exact structure:
                {
                  "emotions": {
                    "joy": number,
                    "sadness": number,
                    "anger": number,
                    "fear": number,
                    "surprise": number,
                    "love": number,
                    "neutral": number
                  },
                  "dominantEmotion": string,
                  "sentiment": string,
                  "sentimentScore": number,
                  "advice": string,
                  "additionalAspects": {
                    "stressLevel": number,
                    "confidence": number,
                    "energy": number,
                    "socialTendency": number
                  }
                }
                
                Text to analyze: "${text}"`
              }]
            }]
          })
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        let responseText = '';
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
          responseText = data.candidates[0].content.parts[0].text;
        } else if (data.predictions && data.predictions[0] && data.predictions[0].content) {
          responseText = data.predictions[0].content;
        } else {
          throw new Error('Unexpected API response format');
        }
        
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Invalid response format from API');
        }
        
        const analysisResult = JSON.parse(jsonMatch[0]);
        
        if (!analysisResult.emotions || !analysisResult.dominantEmotion) {
          throw new Error('Incomplete analysis result from API');
        }
        
        // Calculate typing speed (WPM)
        let wpm = 0;
        let wordCount = 0;
        
        if (typingStart && typingEnd) {
          const words = text.trim().split(/\s+/).filter(Boolean);
          wordCount = words.length;
          const timeTaken = (typingEnd - typingStart) / 60000;
          wpm = timeTaken > 0 ? Math.round(wordCount / timeTaken) : 0;
        }

        return {
          ...analysisResult,
          wpm,
          wordCount
        };
      } else {
        // If no API key, use our improved analysis
        throw new Error('API key not configured. Using enhanced text analysis.');
      }
    } catch (err) {
      console.error('API Error:', err);
      setError(err.message);
      
      // Use our improved analysis as fallback
      const analysisResult = analyzeTextContent(text);
      
      // Calculate typing metrics
      let wpm = 0;
      let wordCount = 0;
      
      if (typingStart && typingEnd) {
        const words = text.trim().split(/\s+/).filter(Boolean);
        wordCount = words.length;
        const timeTaken = (typingEnd - typingStart) / 60000;
        wpm = timeTaken > 0 ? Math.round(wordCount / timeTaken) : 0;
      }
      
      return {
        ...analysisResult,
        wpm,
        wordCount
      };
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    if (!typingStart) setTypingStart(Date.now());
    setTypingEnd(Date.now());
    setInput(e.target.value);
  };

  const analyzeText = async () => {
    if (!input.trim()) {
      setError("Please enter some text to analyze.");
      return;
    }
    
    const analysisResult = await analyzeWithGemini(input);
    if (analysisResult) {
      setResult(analysisResult);
    } else {
      setError("Failed to analyze text. Please try again.");
    }
  };

  const resetAnalysis = () => {
    setInput('');
    setResult(null);
    setTypingStart(null);
    setTypingEnd(null);
    setError(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' }
  ];

  return (
    <div className={`app ${darkMode ? 'dark-mode' : 'light-mode'}`}>
      <div className="container">
        <header>
          <h1>AI EmotionSense Dashboard</h1>
          <div className="controls">
            <div className="language-selector">
              <label htmlFor="language">Language: </label>
              <select 
                id="language" 
                value={language} 
                onChange={(e) => setLanguage(e.target.value)}
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>
            <button className="theme-toggle" onClick={toggleDarkMode}>
              {darkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </header>

        <div className="motivational-quote">
          <i className="quote-icon">"</i>
          Your emotions are valid and important.
          <i className="quote-icon">"</i>
        </div>

        <div className="input-section">
          <textarea
            ref={textareaRef}
            rows="6"
            placeholder="Express your thoughts and feelings here..."
            value={input}
            onChange={handleChange}
            className="text-input"
            disabled={isLoading}
          />
          <div className="button-group">
            <button onClick={analyzeText} disabled={!input.trim() || isLoading}>
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Analyzing with AI...
                </>
              ) : (
                'Analyze Emotions'
              )}
            </button>
            <button onClick={resetAnalysis} className="secondary" disabled={isLoading}>
              Clear
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span> {error}
          </div>
        )}

        {result && (
          <div className="results">
            <h2>Analysis Results</h2>
            
            <div className="metrics">
              <div className="metric">
                <h3>Typing Speed</h3>
                <p className="value">{result.wpm} WPM</p>
              </div>
              <div className="metric">
                <h3>Word Count</h3>
                <p className="value">{result.wordCount}</p>
              </div>
              <div className="metric">
                <h3>Sentiment</h3>
                <p className={`value sentiment-${result.sentiment}`}>
                  {result.sentiment} ({result.sentimentScore > 0 ? '+' : ''}{result.sentimentScore})
                </p>
              </div>
            </div>

            <div className="emotion-results">
              <h3>Emotional Analysis</h3>
              <p>Dominant Emotion: <span className="dominant">{result.dominantEmotion}</span></p>
              
              <div className="emotion-bars">
                {Object.entries(result.emotions)
                  .filter(([emotion, percentage]) => percentage > 0)
                  .sort((a, b) => b[1] - a[1]) // Sort by percentage descending
                  .map(([emotion, percentage]) => (
                    <div key={emotion} className="emotion-bar">
                      <span className="emotion-label">{emotion}</span>
                      <div className="bar-container">
                        <div 
                          className={`bar ${emotion}`} 
                          style={{ width: `${percentage}%` }}
                        >
                          <span className="percentage">{percentage}%</span>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>

            {result.additionalAspects && (
              <div className="additional-aspects">
                <h3>Additional Insights</h3>
                <div className="aspects-grid">
                  <div className="aspect">
                    <h4>Stress Level</h4>
                    <div className="aspect-bar">
                      <div 
                        className="aspect-fill stress" 
                        style={{ width: `${result.additionalAspects.stressLevel}%` }}
                      ></div>
                    </div>
                    <span>{result.additionalAspects.stressLevel}%</span>
                  </div>
                  <div className="aspect">
                    <h4>Confidence</h4>
                    <div className="aspect-bar">
                      <div 
                        className="aspect-fill confidence" 
                        style={{ width: `${result.additionalAspects.confidence}%` }}
                      ></div>
                    </div>
                    <span>{result.additionalAspects.confidence}%</span>
                  </div>
                  <div className="aspect">
                    <h4>Energy Level</h4>
                    <div className="aspect-bar">
                      <div 
                        className="aspect-fill energy" 
                        style={{ width: `${result.additionalAspects.energy}%` }}
                      ></div>
                    </div>
                    <span>{result.additionalAspects.energy}%</span>
                  </div>
                  <div className="aspect">
                    <h4>Social Tendency</h4>
                    <div className="aspect-bar">
                      <div 
                        className="aspect-fill social" 
                        style={{ width: `${result.additionalAspects.socialTendency}%` }}
                      ></div>
                    </div>
                    <span>{result.additionalAspects.socialTendency}%</span>
                  </div>
                </div>
              </div>
            )}

            <div className="advice-section">
              <h3>Personalized Advice</h3>
              <p>{result.advice}</p>
            </div>
          </div>
        )}

        <footer>
          <p>AI EmotionSense - Powered by Gemini AI</p>
          <p className="api-status">
            {GEMINI_API_KEY && GEMINI_API_KEY !== 'demo' ? 
              '✓ Using Gemini API' : 'Using enhanced text analysis'}
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;