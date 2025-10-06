import React, { useState } from 'react';
import { Plus, Phone, MessageCircle, Star, Shield, Clock, CheckCircle, CreditCard as Edit, Mail } from 'lucide-react';
import { ContactForm } from './forms/ContactForm';
import { Contact, supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export function Contacts() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showContactForm, setShowContactForm] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  // Load contacts on component mount
  React.useEffect(() => {
    loadContacts();
  }, [user]);

  const loadContacts = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data: contactsData, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading contacts:', error);
      } else {
        setContacts(contactsData || []);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleContactCreated = (newContact: Contact) => {
    if (editingContact) {
      // Update existing contact
      setContacts(prev => prev.map(contact => 
        contact.id === editingContact.id ? newContact : contact
      ));
    } else {
      // Add new contact
      setContacts(prev => [...prev, newContact]);
    }
    setEditingContact(null);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setShowContactForm(true);
  };

  const handleCloseForm = () => {
    setShowContactForm(false);
    setEditingContact(null);
  };

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
    <div className="h-screen overflow-y-auto pb-20 sm:pb-24">
      {/* Header */}
      <div className="bg-white p-4 sm:p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Contacts</h1>
            <p className="text-sm sm:text-base text-gray-600">Your trusted network</p>
          </div>
          <button className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-500 text-white rounded-full flex items-center justify-center hover:bg-slate-600 transition-colors">
            <Plus 
              className="w-4 h-4 sm:w-5 sm:h-5" 
              onClick={() => setShowContactForm(true)}
            />
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === category.id
                  ? 'bg-slate-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{category.label}</span>
              <span className={`px-1.5 py-0.5 sm:px-2 rounded-full text-xs ${
                selectedCategory === category.id
                  ? 'bg-slate-400'
                  : 'bg-gray-200'
              }`}>
                {category.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {/* Background Check Promotion */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1 text-sm sm:text-base">Background Check Available</h3>
              <p className="text-xs sm:text-sm text-blue-700 mb-3">
                Verify babysitter credentials with our trusted background check partner. 
                Starting at $19.99 per check.
              </p>
              <button className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-600 transition-colors">
                Learn More
              </button>
            </div>
          </div>
        </div>

        {/* Contacts List */}
        <div className="space-y-4">
          {filteredContacts.map((contact) => (
            <div key={contact.id} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 hover:shadow-md transition-all">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-slate-400 to-slate-400 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-sm sm:text-lg">
                    {contact.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{contact.name}</h3>
                    {contact.verified && (
                      <div className="flex items-center space-x-1 bg-green-100 text-green-700 px-1.5 py-0.5 sm:px-2 rounded-full">
                        <CheckCircle className="w-2 h-2 sm:w-3 sm:h-3" />
                        <span className="text-xs font-medium">Verified</span>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-xs sm:text-sm text-gray-600 mb-2">{contact.role}</p>
                  
                  <div className="flex items-center space-x-2 sm:space-x-4 text-xs sm:text-sm text-gray-500 mb-3 flex-wrap">
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3 sm:w-4 sm:h-4 fill-yellow-400 text-yellow-400" />
                      <span>{contact.rating || 0}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>Last contact: {contact.last_contact || 'Never'}</span>
                    </div>
                  </div>
                  
                  <p className="text-xs sm:text-sm text-gray-700 mb-3 line-clamp-2">
                    {contact.notes || 'No notes available'}
                  </p>
                  
                  <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap gap-1">
                    <button 
                      onClick={() => {
                        if (contact.phone) {
                          window.open(`tel:${contact.phone}`, '_self');
                        } else {
                          alert('No phone number available for this contact');
                        }
                      }}
                      className="flex items-center space-x-1 px-2 sm:px-3 py-1 bg-green-500 text-white rounded-lg text-xs sm:text-sm hover:bg-green-600 transition-colors"
                    >
                      <Phone className="w-2 h-2 sm:w-3 sm:h-3" />
                      <span>Call</span>
                    </button>
                    <button 
                      onClick={() => {
                        if (contact.phone) {
                          window.open(`sms:${contact.phone}`, '_self');
                        } else {
                          alert('No phone number available for this contact');
                        }
                      }}
                      className="flex items-center space-x-1 px-2 sm:px-3 py-1 bg-blue-500 text-white rounded-lg text-xs sm:text-sm hover:bg-blue-600 transition-colors"
                    >
                      <MessageCircle className="w-2 h-2 sm:w-3 sm:h-3" />
                      <span>Text</span>
                    </button>
                    <button 
                      onClick={() => {
                        if (contact.email) {
                          window.open(`mailto:${contact.email}`, '_self');
                        } else {
                          alert('No email address available for this contact');
                        }
                      }}
                      className="flex items-center space-x-1 px-2 sm:px-3 py-1 bg-slate-500 text-white rounded-lg text-xs sm:text-sm hover:bg-slate-600 transition-colors"
                    >
                      <Mail className="w-2 h-2 sm:w-3 sm:h-3" />
                      <span>Email</span>
                    </button>
                    {contact.category === 'babysitter' && !contact.verified && (
                      <button className="flex items-center space-x-1 px-2 sm:px-3 py-1 bg-orange-500 text-white rounded-lg text-xs sm:text-sm hover:bg-orange-600 transition-colors">
                        <Shield className="w-2 h-2 sm:w-3 sm:h-3" />
                        <span>Verify</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleEditContact(contact)}
                      className="flex items-center space-x-1 px-2 sm:px-3 py-1 bg-slate-500 text-white rounded-lg text-xs sm:text-sm hover:bg-slate-600 transition-colors"
                    >
                      <Edit className="w-2 h-2 sm:w-3 sm:h-3" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col items-end space-y-2">
                  <div className={`w-3 h-3 rounded-full ${
                    contact.available ? 'bg-green-400' : 'bg-gray-300'
                  }`}></div>
                  <span className="text-xs sm:text-sm text-gray-500">
                    {contact.available ? 'Available' : 'Busy'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredContacts.length === 0 && (
          <div className="text-center py-12">
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-slate-500"></div>
                <span className="ml-2 text-sm sm:text-base text-gray-600">Loading contacts...</span>
              </div>
            ) : (
              <>
                <p className="text-sm sm:text-base text-gray-500 mb-4">No contacts in this category yet</p>
                <button 
                  onClick={() => setShowContactForm(true)}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-slate-500 text-white rounded-xl font-medium hover:bg-slate-600 transition-colors text-sm sm:text-base"
                >
                  Add First Contact
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <ContactForm
        isOpen={showContactForm}
        onClose={handleCloseForm}
        onContactCreated={handleContactCreated}
        editContact={editingContact}
      />
    </div>
  );
}