import React, { useState, useEffect } from 'react';
import { Plus, CheckSquare, User, Calendar, Clock, Star, Filter, Trophy, Target } from 'lucide-react';
import { TaskForm } from './forms/TaskForm';
import { Task, FamilyMember, supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export function Tasks() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string>('all');

  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchFamilyMembers();
    }
  }, [user]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_family_member:family_members(id, name, age)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      // Show user-friendly error message
      alert(`Error loading tasks: ${error.message || 'Please try again.'}`);
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

  const handleTaskCreated = (newTask: Task) => {
    if (editingTask) {
      setTasks(prev => prev.map(task => 
        task.id === editingTask.id ? newTask : task
      ));
    } else {
      setTasks(prev => [newTask, ...prev]);
    }
    setEditingTask(null);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleCloseForm = () => {
    setShowTaskForm(false);
    setEditingTask(null);
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const updateData: any = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { data: updatedTask, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select(`
          *,
          assigned_family_member:family_members(id, name, age)
        `)
        .single();

      if (error) throw error;

      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ));
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Error updating task. Please try again.');
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prev => prev.filter(task => task.id !== taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Error deleting task. Please try again.');
    }
  };

  const getFilteredTasks = () => {
    let filtered = tasks;

    // Filter by status tab
    if (activeTab !== 'all') {
      filtered = filtered.filter(task => task.status === activeTab);
    }

    // Filter by family member
    if (selectedMember !== 'all') {
      filtered = filtered.filter(task => task.assigned_to === selectedMember);
    }

    return filtered;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-theme-secondary text-theme-fg border-gray-200';
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'chores': return '🧹';
      case 'homework': return '📚';
      case 'sports': return '⚽';
      case 'music': return '🎵';
      case 'health': return '🏥';
      case 'social': return '👥';
      default: return '📋';
    }
  };

  const filteredTasks = getFilteredTasks();
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalPoints = tasks
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + (t.points || 0), 0);

  return (
    <div className="h-screen overflow-y-auto pb-20 sm:pb-24">
      {/* Header */}
      <div className="bg-theme-surface p-4 sm:p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tasks</h1>
            <p className="text-sm sm:text-base text-gray-600">Manage family tasks and chores</p>
          </div>
          <button 
            onClick={() => setShowTaskForm(true)}
            className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500 text-white rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
          <div className="bg-green-50 p-2 sm:p-3 rounded-lg text-center">
            <div className="text-lg sm:text-2xl font-bold text-green-600">{completedTasks}</div>
            <div className="text-xs sm:text-sm text-green-700">Completed</div>
          </div>
          <div className="bg-blue-50 p-2 sm:p-3 rounded-lg text-center">
            <div className="text-lg sm:text-2xl font-bold text-blue-600">{tasks.filter(t => t.status === 'pending').length}</div>
            <div className="text-xs sm:text-sm text-blue-700">Pending</div>
          </div>
          <div className="bg-purple-50 p-2 sm:p-3 rounded-lg text-center">
            <div className="text-lg sm:text-2xl font-bold text-purple-600">{totalPoints}</div>
            <div className="text-xs sm:text-sm text-purple-700">Points Earned</div>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Status Tabs */}
          <div className="flex space-x-0.5 sm:space-x-1 bg-theme-secondary rounded-lg p-1">
            {[
              { id: 'all', label: 'All Tasks', icon: CheckSquare },
              { id: 'pending', label: 'Pending', icon: Clock },
              { id: 'in_progress', label: 'In Progress', icon: Target },
              { id: 'completed', label: 'Completed', icon: Trophy }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-2 py-1.5 sm:py-2 px-1 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-theme-surface text-purple-600 shadow-sm'
                    : 'text-theme-fg opacity-70 hover:text-gray-800'
                }`}
              >
                <tab.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          {/* Family Member Filter */}
          <div className="flex items-center space-x-1 sm:space-x-2">
            <Filter className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="px-2 sm:px-3 py-1 border border-theme-border rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Family Members</option>
              <option value="">Unassigned</option>
              {familyMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-purple-500"></div>
            <span className="ml-2 text-sm sm:text-base text-gray-600">Loading tasks...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`p-3 sm:p-4 rounded-xl border-2 transition-all ${
                  task.status === 'completed'
                    ? 'bg-theme-bg border-theme-border opacity-75'
                    : task.priority === 'high'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-theme-surface border-theme-border hover:border-purple-300'
                }`}
              >
                <div className="flex items-start space-x-2 sm:space-x-3">
                  <button
                    onClick={() => {
                      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
                      updateTaskStatus(task.id, newStatus);
                    }}
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      task.status === 'completed'
                        ? 'bg-green-500 border-green-500'
                        : 'border-theme-border hover:border-purple-500'
                    }`}
                  >
                    {task.status === 'completed' && (
                      <CheckSquare className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    )}
                  </button>

                  <div className="flex-1">
                    <div className="flex items-center space-x-1 sm:space-x-2 mb-2">
                      <span className="text-sm sm:text-lg">{getCategoryIcon(task.category || 'other')}</span>
                      <h3 className={`font-semibold text-sm sm:text-base ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {task.title}
                      </h3>
                      <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority || 'medium')}`}>
                        {task.priority}
                      </span>
                      {task.points && task.points > 0 && (
                        <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium flex items-center space-x-1">
                          <Star className="w-2 h-2 sm:w-3 sm:h-3" />
                          <span>{task.points}</span>
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className={`text-xs sm:text-sm mb-2 ${task.status === 'completed' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center space-x-2 sm:space-x-4 text-xs sm:text-sm text-gray-500">
                      {(task as any).assigned_family_member && (
                        <div className="flex items-center space-x-1">
                          <User className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>Assigned to {(task as any).assigned_family_member.name}</span>
                        </div>
                      )}
                      
                      {task.due_date && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>
                            Due {new Date(task.due_date).toLocaleDateString()}
                            {task.due_time && ` at ${task.due_time}`}
                          </span>
                        </div>
                      )}

                      <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-xs font-medium border ${getStatusColor(task.status || 'pending')}`}>
                        {task.status?.replace('_', ' ')}
                      </span>
                    </div>

                    {task.notes && (
                      <p className="text-xs sm:text-sm text-theme-fg opacity-60 mt-2 italic">
                        {task.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col space-y-1 sm:space-y-2">
                    {task.status !== 'completed' && (
                      <select
                        value={task.status}
                        onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                        className="px-1.5 sm:px-2 py-0.5 sm:py-1 border border-theme-border rounded text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    )}
                    
                    <button
                      onClick={() => handleEditTask(task)}
                      className="px-2 sm:px-3 py-0.5 sm:py-1 bg-purple-100 text-purple-600 rounded text-xs hover:bg-purple-200 transition-colors"
                    >
                      Edit
                    </button>
                    
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="px-2 sm:px-3 py-0.5 sm:py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {filteredTasks.length === 0 && !loading && (
              <div className="text-center py-12">
                <CheckSquare className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-theme-fg mb-2">
                  {activeTab === 'all' ? 'No tasks yet' : `No ${activeTab} tasks`}
                </h3>
                <p className="text-sm sm:text-base text-theme-fg opacity-70 mb-4">
                  {activeTab === 'all' 
                    ? 'Create your first task to get started' 
                    : `No tasks with ${activeTab} status`}
                </p>
                <button
                  onClick={() => setShowTaskForm(true)}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors text-sm sm:text-base"
                >
                  Create First Task
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <TaskForm
        isOpen={showTaskForm}
        onClose={handleCloseForm}
        onTaskCreated={handleTaskCreated}
        editTask={editingTask}
      />
    </div>
  );
}