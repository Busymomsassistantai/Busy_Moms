import React, { useState, useEffect } from 'react';
import { Users, Calendar, CheckSquare, Bell, ShoppingBag, Plus, Edit, Trash2, User, ChevronRight, ChevronDown } from 'lucide-react';
import { FamilyMember, Event, Task, Reminder, ShoppingItem, supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { EventForm } from './forms/EventForm';
import { TaskForm } from './forms/TaskForm';
import { ReminderForm } from './forms/ReminderForm';
import { ShoppingForm } from './forms/ShoppingForm';

interface FamilyData {
  member: FamilyMember;
  events: Event[];
  tasks: Task[];
  reminders: Reminder[];
  shoppingItems: ShoppingItem[];
}

export function FamilyFolders() {
  const { user } = useAuth();
  const [familyData, setFamilyData] = useState<FamilyData[]>([]);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [activeModal, setActiveModal] = useState<'event' | 'task' | 'reminder' | 'shopping' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadFamilyData();
    }
  }, [user]);

  const loadFamilyData = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Load family members
      const { data: members, error: membersError } = await supabase
        .from('family_members')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (membersError) throw membersError;

      // Load data for each family member
      const familyDataPromises = (members || []).map(async (member) => {
        const [eventsResult, tasksResult, remindersResult, shoppingResult] = await Promise.all([
          // Events
          supabase
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .contains('participants', [member.name])
            .order('event_date', { ascending: false }),
          
          // Tasks
          supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .eq('assigned_to', member.id)
            .order('created_at', { ascending: false }),
          
          // Reminders
          supabase
            .from('reminders')
            .select('*')
            .eq('user_id', user.id)
            .eq('family_member_id', member.id)
            .order('reminder_date', { ascending: false }),
          
          // Shopping items
          supabase
            .from('shopping_lists')
            .select('*')
            .eq('user_id', user.id)
            .eq('assigned_to', member.id)
            .order('created_at', { ascending: false })
        ]);

        return {
          member,
          events: eventsResult.data || [],
          tasks: tasksResult.data || [],
          reminders: remindersResult.data || [],
          shoppingItems: shoppingResult.data || []
        };
      });

      const familyDataResults = await Promise.all(familyDataPromises);
      setFamilyData(familyDataResults);
    } catch (error) {
      console.error('Error loading family data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMemberExpansion = (memberId: string) => {
    setExpandedMembers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const openModal = (type: 'event' | 'task' | 'reminder' | 'shopping', member: FamilyMember, item?: any) => {
    setSelectedMember(member);
    setEditingItem(item || null);
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedMember(null);
    setEditingItem(null);
  };

  const handleItemCreated = () => {
    closeModal();
    loadFamilyData(); // Refresh all data
  };

  const deleteItem = async (type: 'event' | 'task' | 'reminder' | 'shopping', itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const tableName = type === 'shopping' ? 'shopping_lists' : `${type}s`;
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      loadFamilyData(); // Refresh data
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      alert(`Error deleting ${type}. Please try again.`);
    }
  };

  const getItemCount = (data: FamilyData) => {
    return data.events.length + data.tasks.length + data.reminders.length + data.shoppingItems.length;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-theme-secondary text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-theme-secondary text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="h-screen overflow-y-auto pb-20 sm:pb-24">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-2 text-gray-600">Loading family data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto pb-20 sm:pb-24">
      {/* Header */}
      <div className="bg-theme-surface p-4 sm:p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Family Folders</h1>
            <p className="text-sm sm:text-base text-gray-600">Organize by family member</p>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {familyData.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-theme-fg mb-2">No family members yet</h3>
            <p className="text-theme-fg opacity-70 mb-4">Add family members in Settings to organize their activities</p>
          </div>
        ) : (
          <div className="space-y-4">
            {familyData.map((data) => {
              const isExpanded = expandedMembers.has(data.member.id);
              const itemCount = getItemCount(data);

              return (
                <div key={data.member.id} className="bg-theme-surface border border-theme-border rounded-xl overflow-hidden">
                  {/* Family Member Header */}
                  <button
                    onClick={() => toggleMemberExpansion(data.member.id)}
                    className="w-full p-4 sm:p-6 flex items-center justify-between hover:bg-theme-secondary transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-lg sm:text-xl">
                          {data.member.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg sm:text-xl font-semibold text-gray-900">{data.member.name}</h3>
                        <div className="flex items-center space-x-3 text-sm text-gray-600">
                          {data.member.age && <span>Age {data.member.age}</span>}
                          {data.member.gender && <span>{data.member.gender}</span>}
                          {data.member.school && <span>{data.member.school}</span>}
                        </div>
                        <div className="flex items-center space-x-4 mt-2 text-xs sm:text-sm text-gray-500">
                          <span>{data.events.length} events</span>
                          <span>{data.tasks.length} tasks</span>
                          <span>{data.reminders.length} reminders</span>
                          <span>{data.shoppingItems.length} shopping items</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        {itemCount} items
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-theme-border p-4 sm:p-6 space-y-6">
                      {/* Quick Actions */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                        <button
                          onClick={() => openModal('event', data.member)}
                          className="flex items-center space-x-2 p-2 sm:p-3 bg-blue-50 text-theme-primary rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Calendar className="w-4 h-4" />
                          <span className="text-xs sm:text-sm font-medium">Add Event</span>
                        </button>
                        <button
                          onClick={() => openModal('task', data.member)}
                          className="flex items-center space-x-2 p-2 sm:p-3 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                        >
                          <CheckSquare className="w-4 h-4" />
                          <span className="text-xs sm:text-sm font-medium">Add Task</span>
                        </button>
                        <button
                          onClick={() => openModal('reminder', data.member)}
                          className="flex items-center space-x-2 p-2 sm:p-3 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors"
                        >
                          <Bell className="w-4 h-4" />
                          <span className="text-xs sm:text-sm font-medium">Add Reminder</span>
                        </button>
                        <button
                          onClick={() => openModal('shopping', data.member)}
                          className="flex items-center space-x-2 p-2 sm:p-3 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          <ShoppingBag className="w-4 h-4" />
                          <span className="text-xs sm:text-sm font-medium">Add Item</span>
                        </button>
                      </div>

                      {/* Events Section */}
                      {data.events.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-theme-fg mb-3 flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            <span>Events ({data.events.length})</span>
                          </h4>
                          <div className="space-y-2">
                            {data.events.slice(0, 3).map((event) => (
                              <div key={event.id} className="p-3 bg-blue-50 rounded-lg">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-theme-fg text-sm">{event.title}</h5>
                                    <div className="flex items-center space-x-3 text-xs text-theme-fg opacity-70 mt-1">
                                      <span>{formatDate(event.event_date)}</span>
                                      {event.start_time && <span>{event.start_time.slice(0, 5)}</span>}
                                      {event.location && <span>{event.location}</span>}
                                    </div>
                                  </div>
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() => openModal('event', data.member, event)}
                                      className="p-1 text-theme-primary hover:bg-blue-100 rounded"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => deleteItem('event', event.id)}
                                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {data.events.length > 3 && (
                              <p className="text-xs text-theme-fg opacity-60 text-center">
                                ... and {data.events.length - 3} more events
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tasks Section */}
                      {data.tasks.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-theme-fg mb-3 flex items-center space-x-2">
                            <CheckSquare className="w-4 h-4 text-purple-500" />
                            <span>Tasks ({data.tasks.length})</span>
                          </h4>
                          <div className="space-y-2">
                            {data.tasks.slice(0, 3).map((task) => (
                              <div key={task.id} className="p-3 bg-purple-50 rounded-lg">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <h5 className={`font-medium text-sm ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                      {task.title}
                                    </h5>
                                    <div className="flex items-center space-x-2 text-xs mt-1">
                                      <span className={`px-2 py-0.5 rounded-full font-medium ${getStatusColor(task.status || 'pending')}`}>
                                        {task.status?.replace('_', ' ')}
                                      </span>
                                      {task.priority && (
                                        <span className={`px-2 py-0.5 rounded-full font-medium ${getPriorityColor(task.priority)}`}>
                                          {task.priority}
                                        </span>
                                      )}
                                      {task.due_date && (
                                        <span className="text-gray-600">Due {formatDate(task.due_date)}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() => openModal('task', data.member, task)}
                                      className="p-1 text-purple-600 hover:bg-purple-100 rounded"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => deleteItem('task', task.id)}
                                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {data.tasks.length > 3 && (
                              <p className="text-xs text-theme-fg opacity-60 text-center">
                                ... and {data.tasks.length - 3} more tasks
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Reminders Section */}
                      {data.reminders.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-theme-fg mb-3 flex items-center space-x-2">
                            <Bell className="w-4 h-4 text-orange-500" />
                            <span>Reminders ({data.reminders.length})</span>
                          </h4>
                          <div className="space-y-2">
                            {data.reminders.slice(0, 3).map((reminder) => (
                              <div key={reminder.id} className="p-3 bg-orange-50 rounded-lg">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-theme-fg text-sm">{reminder.title}</h5>
                                    <div className="flex items-center space-x-2 text-xs text-theme-fg opacity-70 mt-1">
                                      <span>{formatDate(reminder.reminder_date)}</span>
                                      {reminder.reminder_time && <span>{reminder.reminder_time.slice(0, 5)}</span>}
                                      {reminder.priority && (
                                        <span className={`px-2 py-0.5 rounded-full font-medium ${getPriorityColor(reminder.priority)}`}>
                                          {reminder.priority}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() => openModal('reminder', data.member, reminder)}
                                      className="p-1 text-orange-600 hover:bg-orange-100 rounded"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => deleteItem('reminder', reminder.id)}
                                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {data.reminders.length > 3 && (
                              <p className="text-xs text-theme-fg opacity-60 text-center">
                                ... and {data.reminders.length - 3} more reminders
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Shopping Items Section */}
                      {data.shoppingItems.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-theme-fg mb-3 flex items-center space-x-2">
                            <ShoppingBag className="w-4 h-4 text-green-500" />
                            <span>Shopping Items ({data.shoppingItems.length})</span>
                          </h4>
                          <div className="space-y-2">
                            {data.shoppingItems.slice(0, 3).map((item) => (
                              <div key={item.id} className={`p-3 rounded-lg ${item.completed ? 'bg-gray-50' : 'bg-green-50'}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <h5 className={`font-medium text-sm ${item.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                      {item.item}
                                    </h5>
                                    <div className="flex items-center space-x-2 text-xs text-theme-fg opacity-70 mt-1">
                                      <span className="capitalize">{item.category}</span>
                                      {item.quantity && item.quantity > 1 && <span>Qty: {item.quantity}</span>}
                                      {item.urgent && (
                                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                                          Urgent
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() => openModal('shopping', data.member, item)}
                                      className="p-1 text-green-600 hover:bg-green-100 rounded"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => deleteItem('shopping', item.id)}
                                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {data.shoppingItems.length > 3 && (
                              <p className="text-xs text-theme-fg opacity-60 text-center">
                                ... and {data.shoppingItems.length - 3} more items
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Empty State */}
                      {itemCount === 0 && (
                        <div className="text-center py-8">
                          <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-theme-fg opacity-60 text-sm">No activities yet for {data.member.name}</p>
                          <p className="text-gray-400 text-xs">Use the buttons above to add events, tasks, reminders, or shopping items</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {activeModal === 'event' && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-theme-surface rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingItem ? 'Edit Event' : `Add Event for ${selectedMember.name}`}
                </h3>
                <button onClick={closeModal} className="w-8 h-8 bg-theme-secondary rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              <EventForm
                event={editingItem}
                onCancel={closeModal}
                onSaved={handleItemCreated}
              />
            </div>
          </div>
        </div>
      )}

      {activeModal === 'task' && selectedMember && (
        <TaskForm
          isOpen={true}
          onClose={closeModal}
          onTaskCreated={handleItemCreated}
          editTask={editingItem}
        />
      )}

      {activeModal === 'reminder' && selectedMember && (
        <ReminderForm
          isOpen={true}
          onClose={closeModal}
          onReminderCreated={handleItemCreated}
          editReminder={editingItem}
          preselectedMember={selectedMember}
        />
      )}

      {activeModal === 'shopping' && selectedMember && (
        <ShoppingForm
          isOpen={true}
          onClose={closeModal}
          onItemCreated={handleItemCreated}
          editItem={editingItem}
        />
      )}
    </div>
  );
}