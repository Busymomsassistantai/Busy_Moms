import React, { useState, useEffect } from 'react';
import { Plus, ShoppingCart, Gift, Repeat, Star, ExternalLink, User } from 'lucide-react';
import { ShoppingForm } from './forms/ShoppingForm';
import { ShoppingItem, FamilyMember, supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export function Shopping() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('list');
  const [showShoppingForm, setShowShoppingForm] = useState(false);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchShoppingList();
      fetchFamilyMembers();
    }
  }, [user]);

  const fetchShoppingList = async () => {
    try {
      setLoading(true);
      const { data: shoppingData, error: shoppingError } = await supabase
        .from('shopping_lists')
        .select(`
          *,
          assigned_family_member:family_members(id, name, age)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (shoppingError) throw shoppingError;
      setShoppingList(shoppingData || []);
    } catch (error) {
      console.error('Error fetching shopping list:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFamilyMembers = async () => {
    if (!user?.id) return;
    
    try {
      const { data: members, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (!error) {
        setFamilyMembers(members || []);
      }
    } catch (error) {
      console.error('Error loading family members:', error);
    }
  };

  const handleItemCreated = (newItem: ShoppingItem) => {
    // Refresh the list to get the assigned family member data
    fetchShoppingList();
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
    <div className="h-screen overflow-y-auto pb-20 sm:pb-24">
      {/* Header */}
      <div className="bg-white p-4 sm:p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Shopping</h1>
            <p className="text-sm sm:text-base text-gray-600">Smart lists and suggestions</p>
          </div>
          <button className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors">
            <Plus 
              className="w-4 h-4 sm:w-5 sm:h-5" 
              onClick={() => setShowShoppingForm(true)}
            />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-0.5 sm:space-x-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'list', label: 'Shopping List', icon: ShoppingCart },
            { id: 'gifts', label: 'Gift Ideas', icon: Gift },
            { id: 'auto', label: 'Auto-Reorder', icon: Repeat }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-2 py-1.5 sm:py-2 px-1 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <tab.icon className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {/* Shopping List Tab */}
        {activeTab === 'list' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
              <h3 className="font-medium text-blue-900 mb-2 text-sm sm:text-base">Voice Input Ready</h3>
              <p className="text-xs sm:text-sm text-blue-700 mb-3">
                Say "Add milk to shopping list" or tap to type manually
              </p>
              <button className="w-full py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors text-sm sm:text-base">
                🎤 Tap to Speak
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-green-500"></div>
                <span className="ml-2 text-sm sm:text-base text-gray-600">Loading shopping list...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {shoppingList.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 sm:p-4 rounded-xl border-2 transition-all ${
                      item.completed
                        ? 'bg-gray-50 border-gray-200 opacity-75'
                        : item.urgent
                        ? 'bg-red-50 border-red-200'
                        : 'bg-white border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <input
                        type="checkbox"
                        checked={item.completed || false}
                        onChange={() => toggleItemCompleted(item.id)}
                        className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 rounded focus:ring-green-500"
                      />
                      <div className="flex-1">
                        <h3 className={`font-medium text-sm sm:text-base ${item.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {item.item}
                        </h3>
                        <div className={`text-xs sm:text-sm ${item.completed ? 'text-gray-400' : 'text-gray-600'}`}>
                          <p>
                            {item.category} {item.quantity && item.quantity > 1 ? `(${item.quantity})` : ''}
                          </p>
                          {(item as any).assigned_family_member && (
                            <div className="flex items-center space-x-1 mt-1">
                              <User className="w-2 h-2 sm:w-3 sm:h-3" />
                              <span className="text-xs">
                                Assigned to {(item as any).assigned_family_member.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {item.urgent && !item.completed && (
                        <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                          Urgent
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && (
              <button 
                onClick={() => setShowShoppingForm(true)}
                className="w-full py-3 sm:py-4 border-2 border-dashed border-gray-300 rounded-xl text-sm sm:text-base text-gray-600 hover:border-green-400 hover:text-green-600 transition-all"
              >
                + Add Item
              </button>
            )}

            {!loading && shoppingList.length === 0 && (
              <div className="text-center py-12">
                <ShoppingCart className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Your shopping list is empty</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4">Add items to get started with smart shopping</p>
                <button
                  onClick={() => setShowShoppingForm(true)}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors text-sm sm:text-base"
                >
                  Add First Item
                </button>
              </div>
            )}
          </div>
        )}

        {/* Gift Ideas Tab */}
        {activeTab === 'gifts' && (
          <div className="space-y-6">
            {giftSuggestions.map((eventGifts) => (
              <div key={eventGifts.id} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
                <div className="mb-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">{eventGifts.event}</h3>
                  <div className="flex items-center space-x-2 sm:space-x-4 text-xs sm:text-sm text-gray-600 mt-1">
                    <span>Age: {eventGifts.age}</span>
                    <span>Gender: {eventGifts.gender}</span>
                    <span>Budget: {eventGifts.budget}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {eventGifts.suggestions.map((gift, index) => (
                    <div key={index} className="flex items-center space-x-3 sm:space-x-4 p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-slate-400 to-slate-400 rounded-lg flex items-center justify-center">
                        <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 text-sm sm:text-base">{gift.name}</h4>
                        <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
                          <span className="font-semibold text-green-600">{gift.price}</span>
                          <div className="flex items-center space-x-1">
                            <Star className="w-2 h-2 sm:w-3 sm:h-3 fill-yellow-400 text-yellow-400" />
                            <span>{gift.rating}</span>
                          </div>
                        </div>
                      </div>
                      <button className="px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-500 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-slate-600 transition-colors flex items-center space-x-1">
                        <ExternalLink className="w-2 h-2 sm:w-3 sm:h-3" />
                        <span>Buy</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="text-center py-8">
              <p className="text-sm sm:text-base text-gray-600 mb-4">No upcoming events requiring gifts</p>
              <button className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-slate-400 to-slate-500 text-white rounded-xl font-medium hover:shadow-lg transition-all text-sm sm:text-base">
                Browse Gift Ideas
              </button>
            </div>
          </div>
        )}

        {/* Auto-Reorder Tab */}
        {activeTab === 'auto' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
              <h3 className="font-medium text-green-900 mb-2 text-sm sm:text-base">Smart Reordering Active</h3>
              <p className="text-xs sm:text-sm text-green-700">
                We automatically reorder essentials based on your family's usage patterns
              </p>
            </div>

            {autoReorders.map((item, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{item.item}</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-base sm:text-lg font-bold text-green-600">{item.price}</span>
                    <div className="w-6 h-3 sm:w-8 sm:h-4 bg-green-500 rounded-full relative">
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full absolute top-0.5 right-0.5 shadow"></div>
                    </div>
                  </div>
                </div>
                <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                  <p><span className="font-medium">Next order:</span> {item.nextOrder}</p>
                  <p><span className="font-medium">Frequency:</span> {item.frequency}</p>
                </div>
                <div className="flex space-x-2 mt-3 flex-wrap gap-1">
                  <button className="px-2 sm:px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs sm:text-sm hover:bg-gray-200 transition-colors">
                    Order Now
                  </button>
                  <button className="px-2 sm:px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs sm:text-sm hover:bg-gray-200 transition-colors">
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