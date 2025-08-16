import React, { useState } from 'react';
import { User, Bell, Shield, Smartphone, MessageCircle, CreditCard, HelpCircle, LogOut, Database, CheckCircle, XCircle, Loader2, Plus, Edit } from 'lucide-react';
import { FamilyMemberForm } from './forms/FamilyMemberForm';
import { ConnectionTest } from './ConnectionTest';
import { AuthTest } from './AuthTest';
import { FamilyMember, supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export function Settings() {
  const { user, signOut } = useAuth();
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [showConnectionTest, setShowConnectionTest] = useState(false);
  const [showAuthTest, setShowAuthTest] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [notifications, setNotifications] = useState({
    events: true,
    shopping: true,
    reminders: true,
    whatsapp: false
  });

  // Load family members on component mount
  React.useEffect(() => {
    loadFamilyMembers();
  }, []);

  const loadFamilyMembers = async () => {
    setLoadingMembers(true);
    try {
      if (user) {
        // Load family members from Supabase for authenticated user
        const { data: members, error } = await supabase
          .from('family_members')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.warn('Could not load family members from database:', error.message);
          setFamilyMembers([]);
        } else {
          setFamilyMembers(members || []);
        }
      } else {
        // No user, show empty list
        setFamilyMembers([]);
      }
    } catch (error) {
      console.error('Error loading family members:', error);
      setFamilyMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const deleteFamilyMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to delete this family member?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('id', memberId);

      if (error) {
        throw error;
      }

      // Remove from local state
      setFamilyMembers(prev => prev.filter(member => member.id !== memberId));
    } catch (error) {
      console.error('Error deleting family member:', error);
      alert('Error deleting family member. Please try again.');
    }
  };

  const settingSections = [
    {
      title: 'Family Profile',
      items: [
        {
          icon: User,
          title: 'Family Members',
          description: 'Manage your family members',
          action: 'Add',
          showAddButton: true
        },
        {
          icon: Shield,
          title: 'Privacy & Safety',
          description: 'Allergies, medical info, emergency contacts',
          action: 'Manage'
        }
      ]
    },
    {
      title: 'System',
      items: [
        {
          icon: Database,
          title: 'Test Supabase Connection',
          description: 'Verify database connectivity',
          action: 'Test',
          onClick: () => setShowConnectionTest(true)
        },
        {
          icon: User,
          title: 'Test Authentication',
          description: 'Setup and test demo user login',
          action: 'Test',
          onClick: () => setShowAuthTest(true)
        }
      ]
    },
    {
      title: 'Integrations',
      items: [
        {
          icon: MessageCircle,
          title: 'WhatsApp Integration',
          description: 'Parse messages and images for events',
          toggle: true,
          enabled: notifications.whatsapp
        },
        {
          icon: Smartphone,
          title: 'Smartwatch',
          description: 'Apple Watch connected',
          action: 'Paired'
        }
      ]
    },
    {
      title: 'Notifications',
      items: [
        {
          icon: Bell,
          title: 'Event Reminders',
          description: 'Get notified about upcoming events',
          toggle: true,
          enabled: notifications.events
        },
        {
          icon: Bell,
          title: 'Shopping Alerts',
          description: 'Auto-reorder and list reminders',
          toggle: true,
          enabled: notifications.shopping
        }
      ]
    },
    {
      title: 'Account',
      items: [
        {
          icon: CreditCard,
          title: 'Subscription',
          description: 'Premium Plan - $9.99/month',
          action: 'Manage'
        },
        {
          icon: HelpCircle,
          title: 'Help & Support',
          description: 'FAQs, contact support',
          action: 'View'
        }
      ]
    }
  ];

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleFamilyMemberCreated = (newMember: FamilyMember) => {
    setFamilyMembers(prev => [...prev, newMember]);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="h-screen overflow-y-auto pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Sarah Johnson</h1>
            <p className="text-purple-100">sarah.johnson@email.com</p>
          </div>
        </div>
        
        <div className="bg-white bg-opacity-10 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">Premium Plan</h3>
              <p className="text-sm text-purple-100">All features unlocked</p>
            </div>
            <div className="px-3 py-1 bg-white bg-opacity-20 rounded-full">
              <span className="text-sm font-medium">Active</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* AI Personality Setting */}
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-purple-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3">AI Assistant Personality</h3>
          <div className="grid grid-cols-3 gap-2">
            {['Friendly', 'Professional', 'Humorous'].map((personality) => (
              <button
                key={personality}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  personality === 'Friendly'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-purple-100'
                }`}
              >
                {personality}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {settingSections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{section.title}</h2>
              <div className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <item.icon className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{item.title}</h3>
                          <p className="text-sm text-gray-600">{item.description}</p>
                        </div>
                      </div>
                      
                      {item.toggle ? (
                        <button
                          onClick={() => toggleNotification(item.title.includes('WhatsApp') ? 'whatsapp' : item.title.includes('Event') ? 'events' : 'shopping')}
                          className={`w-12 h-6 rounded-full relative transition-all ${
                            item.enabled ? 'bg-purple-500' : 'bg-gray-300'
                          }`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${
                            item.enabled ? 'right-0.5' : 'left-0.5'
                          }`}></div>
                        </button>
                      ) : (
                        <button className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors">
                          <button 
                            onClick={() => {
                              if (item.title === 'Family Members') {
                                setShowFamilyForm(true);
                              } else if (item.onClick) {
                                item.onClick();
                              }
                            }}
                            className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                          >
                            {item.action}
                          </button>
                        </button>
                      )}
                      
                      {item.showAddButton && (
                        <button
                          onClick={() => setShowFamilyForm(true)}
                          className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors ml-2"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Family Members List */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Family Members</h2>
            <button
              onClick={() => setShowFamilyForm(true)}
              className="w-10 h-10 bg-purple-500 text-white rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          {loadingMembers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              <span className="ml-2 text-gray-600">Loading family members...</span>
            </div>
          ) : familyMembers.length > 0 ? (
            <div className="space-y-3">
              {familyMembers.map((member) => (
                <div key={member.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-lg">
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="font-semibold text-gray-900">{member.name}</h3>
                          {member.age && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                              Age {member.age}
                            </span>
                          )}
                          {member.gender && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                              {member.gender}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-600 space-y-1">
                          {member.school && (
                            <p>
                              <span className="font-medium">School:</span> {member.school}
                              {member.grade && ` (${member.grade})`}
                            </p>
                          )}
                          {member.allergies && member.allergies.length > 0 && (
                            <p className="text-red-600">
                              <span className="font-medium">Allergies:</span> {member.allergies.join(', ')}
                            </p>
                          )}
                          {member.medical_notes && (
                            <p className="text-blue-600">
                              <span className="font-medium">Medical:</span> {member.medical_notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setEditingMember(member);
                          setShowFamilyForm(true);
                        }}
                        className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-sm hover:bg-blue-200 transition-colors"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => deleteFamilyMember(member.id)}
                        className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No family members yet</h3>
              <p className="text-gray-600 mb-4">Add your children and family members to get started</p>
              <button
                onClick={() => setShowFamilyForm(true)}
                className="px-6 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors"
              >
                Add First Family Member
              </button>
            </div>
          )}
        </div>

        {/* Remove the old family members section */}
        {false && loadingMembers ? (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Family Members</h2>
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              <span className="ml-2 text-gray-600">Loading family members...</span>
            </div>
          </div>
        ) : familyMembers.length > 0 ? (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Family Members</h2>
            <div className="space-y-2">
              {familyMembers.map((member) => (
                <div key={member.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{member.name}</h3>
                      <p className="text-sm text-gray-600">
                        {member.age && `Age ${member.age}`}{member.gender && ` • ${member.gender}`}
                        {member.school && ` • ${member.school}`}
                        {member.grade && ` (${member.grade})`}
                      </p>
                      {member.allergies && member.allergies.length > 0 && (
                        <p className="text-xs text-red-600 mt-1">
                          Allergies: {member.allergies.join(', ')}
                        </p>
                      )}
                      {member.medical_notes && (
                        <p className="text-xs text-blue-600 mt-1">
                          Medical: {member.medical_notes}
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => deleteFamilyMember(member.id)}
                        className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Family Members</h2>
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No family members yet</h3>
              <p className="text-gray-600 mb-4">Add your children and family members to get started</p>
              <button
                onClick={() => setShowFamilyForm(true)}
                className="px-6 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors"
              >
                Add First Family Member
              </button>
            </div>
          </div>
        )}

        {/* Background Check History */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Background Check History</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-medium text-gray-900">Maria Rodriguez</h3>
                <p className="text-sm text-gray-600">Completed March 10, 2025</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  ✓ Passed
                </div>
              </div>
            </div>
            <button className="text-purple-600 text-sm hover:underline">
              View Full Report
            </button>
          </div>
        </div>

        {/* Sign Out */}
        <button 
          onClick={handleSignOut}
          className="w-full mt-8 py-3 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors flex items-center justify-center space-x-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      <FamilyMemberForm
        isOpen={showFamilyForm}
        onClose={() => {
          setShowFamilyForm(false);
          setEditingMember(null);
        }}
        editMember={editingMember}
        onMemberCreated={(newMember) => {
          handleFamilyMemberCreated(newMember);
          loadFamilyMembers(); // Reload the list
          setEditingMember(null);
        }}
      />

      <ConnectionTest
        isOpen={showConnectionTest}
        onClose={() => setShowConnectionTest(false)}
      />

      <AuthTest
        isOpen={showAuthTest}
        onClose={() => setShowAuthTest(false)}
      />
    </div>
  );
}