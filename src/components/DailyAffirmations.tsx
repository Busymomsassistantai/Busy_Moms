import React, { useState, useEffect } from 'react';
import { Sparkles, Heart, Calendar, RefreshCw, X, Loader2, Star, Volume2 } from 'lucide-react';
import { affirmationService } from '../services/affirmationService';
import { Affirmation } from '../lib/supabase';

interface DailyAffirmationsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DailyAffirmations({ isOpen, onClose }: DailyAffirmationsProps) {
  const [affirmations, setAffirmations] = useState<Affirmation[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAffirmations();
    } else {
      if (speaking && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
      }
    }
  }, [isOpen, speaking]);

  const loadAffirmations = async () => {
    setLoading(true);
    try {
      const history = await affirmationService.getAffirmationHistory(30);
      setAffirmations(history);

      const today = new Date().toISOString().split('T')[0];
      const hasTodayAffirmation = history.some(a => a.generated_date === today);

      if (!hasTodayAffirmation) {
        console.log('No affirmation for today, auto-generating...');
        setGenerating(true);
        try {
          const newAffirmation = await affirmationService.generateAffirmation(false);
          setAffirmations([newAffirmation, ...history]);
        } catch (error) {
          console.error('Error auto-generating affirmation:', error);
        } finally {
          setGenerating(false);
        }
      }
    } catch (error) {
      console.error('Error loading affirmations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const newAffirmation = await affirmationService.generateAffirmation(true);
      setAffirmations((prev) => {
        const filtered = prev.filter((a) => a.generated_date !== newAffirmation.generated_date);
        return [newAffirmation, ...filtered];
      });
    } catch (error) {
      console.error('Error generating affirmation:', error);
      alert('Failed to generate affirmation. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleFavorite = async (affirmation: Affirmation) => {
    try {
      await affirmationService.toggleFavorite(affirmation.id, !affirmation.favorited);
      setAffirmations((prev) =>
        prev.map((a) =>
          a.id === affirmation.id ? { ...a, favorited: !a.favorited } : a
        )
      );
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleSpeakAffirmation = (text: string) => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(
        (voice) =>
          voice.name.includes('Female') ||
          voice.name.includes('Samantha') ||
          voice.name.includes('Karen') ||
          voice.name.includes('Victoria') ||
          voice.name.includes('Google US English') ||
          voice.name.includes('Microsoft Zira')
      );
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } else {
      alert('Speech synthesis is not supported in your browser.');
    }
  };

  const todayAffirmation = affirmations.find(
    (a) => a.generated_date === new Date().toISOString().split('T')[0]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Daily Affirmations</h2>
              <p className="text-purple-100 text-sm">Your personalized encouragement</p>
            </div>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('today')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'today'
                  ? 'bg-white text-purple-600'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-white text-purple-600'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              History
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : activeTab === 'today' ? (
            <div>
              {todayAffirmation ? (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-6 relative">
                    <div className="absolute top-4 right-4 flex space-x-2">
                      <button
                        onClick={() => handleSpeakAffirmation(todayAffirmation.affirmation_text)}
                        className={`w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform ${
                          speaking ? 'animate-pulse' : ''
                        }`}
                        title={speaking ? 'Stop reading' : 'Read affirmation aloud'}
                      >
                        <Volume2 className={`w-5 h-5 ${speaking ? 'text-purple-600' : 'text-gray-600'}`} />
                      </button>
                      <button
                        onClick={() => handleToggleFavorite(todayAffirmation)}
                        className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                      >
                        {todayAffirmation.favorited ? (
                          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        ) : (
                          <Star className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center space-x-2 mb-4">
                      <Calendar className="w-5 h-5 text-purple-600" />
                      <span className="text-sm font-medium text-purple-600">
                        {new Date().toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <p className="text-lg text-gray-800 leading-relaxed mb-4 pr-24">
                      {todayAffirmation.affirmation_text}
                    </p>

                    {todayAffirmation.data_sources && (
                      <div className="flex flex-wrap gap-2">
                        {todayAffirmation.data_sources.calendar && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                            Calendar
                          </span>
                        )}
                        {todayAffirmation.data_sources.tasks && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                            Tasks
                          </span>
                        )}
                        {todayAffirmation.data_sources.family && (
                          <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded-full text-xs">
                            Family
                          </span>
                        )}
                        {todayAffirmation.data_sources.shopping && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                            Shopping
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Regenerating...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5" />
                        <span>Regenerate Affirmation</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Sparkles className="w-10 h-10 text-purple-500" />
                  </div>
                  {generating ? (
                    <>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Generating Your Affirmation
                      </h3>
                      <p className="text-gray-600">
                        Creating personalized encouragement based on your schedule...
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Preparing Your Affirmation
                      </h3>
                      <p className="text-gray-600">
                        Your daily affirmation will appear automatically
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {affirmations.length > 0 ? (
                affirmations.map((affirmation) => (
                  <div
                    key={affirmation.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all relative"
                  >
                    <div className="absolute top-4 right-4 flex space-x-2">
                      <button
                        onClick={() => handleSpeakAffirmation(affirmation.affirmation_text)}
                        className={`w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform ${
                          speaking ? 'animate-pulse' : ''
                        }`}
                        title={speaking ? 'Stop reading' : 'Read affirmation aloud'}
                      >
                        <Volume2 className={`w-4 h-4 ${speaking ? 'text-purple-600' : 'text-gray-400'}`} />
                      </button>
                      <button
                        onClick={() => handleToggleFavorite(affirmation)}
                        className="w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform"
                      >
                        {affirmation.favorited ? (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        ) : (
                          <Star className="w-4 h-4 text-gray-300" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center space-x-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        {new Date(affirmation.generated_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      {affirmation.favorited && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs ml-2">
                          Favorite
                        </span>
                      )}
                    </div>

                    <p className="text-gray-800 leading-relaxed pr-16">
                      {affirmation.affirmation_text}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No affirmations yet. Generate your first one!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
