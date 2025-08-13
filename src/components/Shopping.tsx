import React, { useState } from 'react';
import { Plus, ShoppingCart, Gift, Repeat, Star, ExternalLink } from 'lucide-react';
import { ShoppingForm } from './forms/ShoppingForm';
import { ShoppingItem } from '../lib/supabase';

export function Shopping() {
  const [activeTab, setActiveTab] = useState('list');
  const [showShoppingForm, setShowShoppingForm] = useState(false);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);

  const handleItemCreated = (newItem: ShoppingItem) => {
    setShoppingList(prev => [...prev, newItem]);
  };

  const toggleItemCompleted = (itemId: string) => {
    setShoppingList(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, completed: !item.completed }
          : item
      )
    );
  };

  const giftSuggestions = [
    {
      id: 1,
      event: 'Jessica\'s Birthday Party',
      age: 7,
      gender: 'Girl',
      budget: '$15-25',
      suggestions: [
        { name: 'Art Supplies Set', price: '$19.99', rating: 4.8, link: '#' },
        { name: 'Princess Dress-up Kit', price: '$24.99', rating: 4.6, link: '#' },
        { name: 'Children\'s Book Collection', price: '$16.99', rating: 4.9, link: '#' }
      ]
    }
  ];

  const autoReorders = [
    { item: 'Huggies Size 3', nextOrder: 'March 20', frequency: 'Every 2 weeks', price: '$42.99' },
    { item: 'Formula Powder', nextOrder: 'March 18', frequency: 'Weekly', price: '$28.99' },
    { item: 'Organic Milk', nextOrder: 'March 22', frequency: 'Every 3 days', price: '$6.99' }
  ];

  return (
    <div className="h-screen overflow-y-auto pb-20">
      {/* Header */}
      <div className="bg-white p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shopping</h1>
            <p className="text-gray-600">Smart lists and suggestions</p>
          </div>
          <button className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors">
            <Plus 
              className="w-5 h-5" 
              onClick={() => setShowShoppingForm(true)}
            />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'list', label: 'Shopping List', icon: ShoppingCart },
            { id: 'gifts', label: 'Gift Ideas', icon: Gift },
            { id: 'auto', label: 'Auto-Reorder', icon: Repeat }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Shopping List Tab */}
        {activeTab === 'list' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <h3 className="font-medium text-blue-900 mb-2">Voice Input Ready</h3>
              <p className="text-sm text-blue-700 mb-3">
                Say "Add milk to shopping list" or tap to type manually
              </p>
              <button className="w-full py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
                🎤 Tap to Speak
              </button>
            </div>

            <div className="space-y-3">
              {shoppingList.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    item.completed
                      ? 'bg-gray-50 border-gray-200 opacity-75'
                      : item.urgent
                      ? 'bg-red-50 border-red-200'
                      : 'bg-white border-gray-200 hover:border-green-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => toggleItemCompleted(item.id)}
                      className="w-5 h-5 text-green-500 rounded focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <h3 className={`font-medium ${item.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {item.item}
                      </h3>
                      <p className={`text-sm ${item.completed ? 'text-gray-400' : 'text-gray-600'}`}>
                        {item.category} {item.quantity && item.quantity > 1 ? `(${item.quantity})` : ''}
                      </p>
                    </div>
                    {item.urgent && !item.completed && (
                      <div className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        Urgent
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-green-400 hover:text-green-600 transition-all">
              <span onClick={() => setShowShoppingForm(true)}>
                + Add Item
              </span>
            </button>
          </div>
        )}

        {/* Gift Ideas Tab */}
        {activeTab === 'gifts' && (
          <div className="space-y-6">
            {giftSuggestions.map((eventGifts) => (
              <div key={eventGifts.id} className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{eventGifts.event}</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                    <span>Age: {eventGifts.age}</span>
                    <span>Gender: {eventGifts.gender}</span>
                    <span>Budget: {eventGifts.budget}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {eventGifts.suggestions.map((gift, index) => (
                    <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-400 rounded-lg flex items-center justify-center">
                        <Gift className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{gift.name}</h4>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <span className="font-semibold text-green-600">{gift.price}</span>
                          <div className="flex items-center space-x-1">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span>{gift.rating}</span>
                          </div>
                        </div>
                      </div>
                      <button className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors flex items-center space-x-1">
                        <ExternalLink className="w-3 h-3" />
                        <span>Buy</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No upcoming events requiring gifts</p>
              <button className="px-6 py-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-xl font-medium hover:shadow-lg transition-all">
                Browse Gift Ideas
              </button>
            </div>
          </div>
        )}

        {/* Auto-Reorder Tab */}
        {activeTab === 'auto' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <h3 className="font-medium text-green-900 mb-2">Smart Reordering Active</h3>
              <p className="text-sm text-green-700">
                We automatically reorder essentials based on your family's usage patterns
              </p>
            </div>

            {autoReorders.map((item, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{item.item}</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-bold text-green-600">{item.price}</span>
                    <div className="w-8 h-4 bg-green-500 rounded-full relative">
                      <div className="w-3 h-3 bg-white rounded-full absolute top-0.5 right-0.5 shadow"></div>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><span className="font-medium">Next order:</span> {item.nextOrder}</p>
                  <p><span className="font-medium">Frequency:</span> {item.frequency}</p>
                </div>
                <div className="flex space-x-2 mt-3">
                  <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors">
                    Order Now
                  </button>
                  <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors">
                    Edit Schedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ShoppingForm
        isOpen={showShoppingForm}
        onClose={() => setShowShoppingForm(false)}
        onItemCreated={handleItemCreated}
      />
    </div>
  );
}