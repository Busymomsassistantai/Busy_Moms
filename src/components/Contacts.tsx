import React, { useState } from 'react';
import { Plus, Phone, MessageCircle, Star, Shield, Clock, CheckCircle } from 'lucide-react';

export function Contacts() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const contacts = [
    {
      id: 1,
      name: 'Maria Rodriguez',
      role: 'Babysitter',
      phone: '(555) 123-4567',
      rating: 4.9,
      notes: 'Kids love her mac & cheese. Always arrives early. Great with bedtime routine.',
      verified: true,
      category: 'babysitter',
      available: true,
      lastContact: '2 days ago'
    },
    {
      id: 2,
      name: 'Coach Johnson',
      role: 'Soccer Coach',
      phone: '(555) 234-5678',
      rating: 4.7,
      notes: 'Emma\'s soccer coach. Very encouraging and patient with kids.',
      verified: false,
      category: 'coach',
      available: true,
      lastContact: '1 week ago'
    },
    {
      id: 3,
      name: 'Dr. Sarah Smith',
      role: 'Pediatrician',
      phone: '(555) 345-6789',
      rating: 4.8,
      notes: 'Great with kids. Office hours Mon-Fri 9-5. Accepts our insurance.',
      verified: true,
      category: 'doctor',
      available: false,
      lastContact: '3 weeks ago'
    },
    {
      id: 4,
      name: 'Jennifer Kim',
      role: 'Math Tutor',
      phone: '(555) 456-7890',
      rating: 5.0,
      notes: 'Excellent at explaining concepts. Tom\'s grades improved significantly.',
      verified: true,
      category: 'tutor',
      available: true,
      lastContact: '5 days ago'
    }
  ];

  const categories = [
    { id: 'all', label: 'All Contacts', count: contacts.length },
    { id: 'babysitter', label: 'Babysitters', count: contacts.filter(c => c.category === 'babysitter').length },
    { id: 'coach', label: 'Coaches', count: contacts.filter(c => c.category === 'coach').length },
    { id: 'doctor', label: 'Medical', count: contacts.filter(c => c.category === 'doctor').length },
    { id: 'tutor', label: 'Tutors', count: contacts.filter(c => c.category === 'tutor').length }
  ];

  const filteredContacts = selectedCategory === 'all' 
    ? contacts 
    : contacts.filter(contact => contact.category === selectedCategory);

  return (
    <div className="h-screen overflow-y-auto pb-20">
      {/* Header */}
      <div className="bg-white p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
            <p className="text-gray-600">Your trusted network</p>
          </div>
          <button className="w-10 h-10 bg-purple-500 text-white rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex space-x-2 overflow-x-auto">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === category.id
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{category.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                selectedCategory === category.id
                  ? 'bg-purple-400'
                  : 'bg-gray-200'
              }`}>
                {category.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Background Check Promotion */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Shield className="w-6 h-6 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">Background Check Available</h3>
              <p className="text-sm text-blue-700 mb-3">
                Verify babysitter credentials with our trusted background check partner. 
                Starting at $19.99 per check.
              </p>
              <button className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
                Learn More
              </button>
            </div>
          </div>
        </div>

        {/* Contacts List */}
        <div className="space-y-4">
          {filteredContacts.map((contact) => (
            <div key={contact.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-lg">
                    {contact.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{contact.name}</h3>
                    {contact.verified && (
                      <div className="flex items-center space-x-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        <span className="text-xs font-medium">Verified</span>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">{contact.role}</p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span>{contact.rating}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>Last contact: {contact.lastContact}</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                    {contact.notes}
                  </p>
                  
                  <div className="flex items-center space-x-2">
                    <button className="flex items-center space-x-1 px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors">
                      <Phone className="w-3 h-3" />
                      <span>Call</span>
                    </button>
                    <button className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors">
                      <MessageCircle className="w-3 h-3" />
                      <span>Text</span>
                    </button>
                    {contact.category === 'babysitter' && !contact.verified && (
                      <button className="flex items-center space-x-1 px-3 py-1 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 transition-colors">
                        <Shield className="w-3 h-3" />
                        <span>Verify</span>
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col items-end space-y-2">
                  <div className={`w-3 h-3 rounded-full ${
                    contact.available ? 'bg-green-400' : 'bg-gray-300'
                  }`}></div>
                  <span className="text-xs text-gray-500">
                    {contact.available ? 'Available' : 'Busy'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredContacts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No contacts in this category yet</p>
            <button className="px-6 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors">
              Add First Contact
            </button>
          </div>
        )}
      </div>
    </div>
  );
}