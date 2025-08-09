import React, { useState } from 'react';
import { Heart, Users, Shield, Calendar, MessageCircle, Watch, MapPin, Bell } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [userType, setUserType] = useState('');

  const steps = [
    {
      title: 'Welcome to Your Life Assistant',
      subtitle: 'You take care of the love, we\'ll handle the rest.',
      content: (
        <div className="text-center space-y-8">
          <div className="w-32 h-32 mx-auto bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
            <Heart className="w-16 h-16 text-white" />
          </div>
          <p className="text-gray-600 text-lg leading-relaxed">
            Your AI-powered companion for managing family life, events, and daily tasks with ease.
          </p>
        </div>
      )
    },
    {
      title: 'Tell us about yourself',
      subtitle: 'This helps us personalize your experience',
      content: (
        <div className="space-y-4">
          {['Mom', 'Dad', 'Guardian', 'Other'].map((type) => (
            <button
              key={type}
              onClick={() => setUserType(type)}
              className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
                userType === type
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Users className="w-5 h-5 text-purple-500" />
                <span className="font-medium">{type}</span>
              </div>
            </button>
          ))}
        </div>
      )
    },
    {
      title: 'Enable Smart Features',
      subtitle: 'Grant permissions to unlock the full experience',
      content: (
        <div className="space-y-4">
          {[
            { icon: Calendar, title: 'Calendar Access', desc: 'Sync your events automatically' },
            { icon: MessageCircle, title: 'WhatsApp Integration', desc: 'Parse invitations and reminders' },
            { icon: Watch, title: 'Smartwatch', desc: 'Voice commands and quick actions' },
            { icon: MapPin, title: 'Location', desc: 'Smart reminders based on location' },
            { icon: Bell, title: 'Notifications', desc: 'Never miss important events' }
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Icon className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{title}</h4>
                  <p className="text-sm text-gray-600">{desc}</p>
                </div>
                <div className="w-12 h-6 bg-purple-500 rounded-full relative">
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )
    },
    {
      title: 'You\'re all set!',
      subtitle: 'Ready to make your life easier?',
      content: (
        <div className="text-center space-y-6">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
            <Shield className="w-12 h-12 text-white" />
          </div>
          <p className="text-gray-600">
            Your AI assistant is ready to help you manage your family life with smart reminders, 
            event planning, and personalized suggestions.
          </p>
          <div className="bg-purple-50 p-4 rounded-xl">
            <p className="text-purple-800 font-medium">
              "What can I help you with today?"
            </p>
          </div>
        </div>
      )
    }
  ];

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  return (
    <div className="h-screen flex flex-col p-6">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-500">Step {step + 1} of {steps.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {steps[step].title}
          </h1>
          <p className="text-gray-600">
            {steps[step].subtitle}
          </p>
        </div>

        <div className="flex-1">
          {steps[step].content}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <button
          onClick={prevStep}
          disabled={step === 0}
          className={`px-6 py-3 rounded-xl font-medium transition-all ${
            step === 0
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-purple-600 hover:bg-purple-50'
          }`}
        >
          Back
        </button>
        <button
          onClick={nextStep}
          disabled={step === 1 && !userType}
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {step === steps.length - 1 ? 'Get Started' : 'Next'}
        </button>
      </div>
    </div>
  );
}