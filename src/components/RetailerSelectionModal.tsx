import { useState } from 'react';
import { X, MapPin, Search, Loader2, Store, Star, Check } from 'lucide-react';
import { instacartShoppingService } from '../services/instacartShoppingService';
import type { Retailer, UserPreferredRetailer } from '../lib/supabase';

interface RetailerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onRetailerSelected: (retailer: UserPreferredRetailer | null) => void;
  currentRetailer?: UserPreferredRetailer | null;
}

export function RetailerSelectionModal({
  isOpen,
  onClose,
  userId,
  onRetailerSelected,
  currentRetailer,
}: RetailerSelectionModalProps) {
  const [postalCode, setPostalCode] = useState('');
  const [countryCode, setCountryCode] = useState<'US' | 'CA'>('US');
  const [searchResults, setSearchResults] = useState<Retailer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!postalCode.trim()) {
      setError('Please enter a postal code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await instacartShoppingService.getNearbyRetailers(postalCode, countryCode);
      setSearchResults(response.retailers);
      if (response.retailers.length === 0) {
        setError('No retailers found in this area');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search retailers');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRetailer = (retailer: Retailer) => {
    setSelectedRetailer(retailer);
  };

  const handleConfirm = async () => {
    if (!selectedRetailer) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const exists = await instacartShoppingService.checkRetailerExists(userId, selectedRetailer.retailer_key);

      let savedRetailer;
      if (exists) {
        const retailers = await instacartShoppingService.getPreferredRetailers(userId);
        savedRetailer = retailers.find(r => r.retailer_key === selectedRetailer.retailer_key);
        if (savedRetailer) {
          setSuccessMessage(`Using ${selectedRetailer.name} from your saved retailers!`);
        }
      } else {
        savedRetailer = await instacartShoppingService.savePreferredRetailer(
          userId,
          selectedRetailer,
          false
        );
        setSuccessMessage(`${selectedRetailer.name} has been saved!`);
      }

      setTimeout(() => {
        onRetailerSelected(savedRetailer || null);
        onClose();
      }, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save retailer';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleSetAsPrimary = async () => {
    if (!selectedRetailer) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const exists = await instacartShoppingService.checkRetailerExists(userId, selectedRetailer.retailer_key);

      let savedRetailer;
      if (exists) {
        const retailers = await instacartShoppingService.getPreferredRetailers(userId);
        const existingRetailer = retailers.find(r => r.retailer_key === selectedRetailer.retailer_key);
        if (existingRetailer) {
          await instacartShoppingService.setPrimaryRetailer(userId, existingRetailer.id);
          savedRetailer = { ...existingRetailer, is_primary: true };
        }
      } else {
        savedRetailer = await instacartShoppingService.savePreferredRetailer(
          userId,
          selectedRetailer,
          true
        );
      }

      setSuccessMessage(`${selectedRetailer.name} is now your primary retailer!`);
      setTimeout(() => {
        onRetailerSelected(savedRetailer || null);
        onClose();
      }, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save retailer';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleUseCurrent = () => {
    onRetailerSelected(currentRetailer || null);
    onClose();
  };

  const handleSkip = () => {
    onRetailerSelected(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <Store className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Select a Retailer</h2>
                <p className="text-sm text-gray-600">Choose where to shop for your items</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {currentRetailer && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {currentRetailer.retailer_logo_url && (
                    <img
                      src={currentRetailer.retailer_logo_url}
                      alt={currentRetailer.retailer_name}
                      className="w-12 h-12 object-contain"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">{currentRetailer.retailer_name}</h3>
                    <p className="text-sm text-gray-600">Your primary retailer</p>
                  </div>
                </div>
                <button
                  onClick={handleUseCurrent}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  Use This Retailer
                </button>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500" />
              Search for Retailers Near You
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter postal code (e.g., 94102)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value as 'US' | 'CA')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="US">US</option>
                <option value="CA">CA</option>
              </select>
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Search</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
              <Check className="w-4 h-4" />
              {successMessage}
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Available Retailers ({searchResults.length})
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {searchResults.map((retailer) => (
                  <button
                    key={retailer.retailer_key}
                    onClick={() => handleSelectRetailer(retailer)}
                    className={`w-full flex items-center gap-4 p-4 border-2 rounded-lg transition-all text-left ${
                      selectedRetailer?.retailer_key === retailer.retailer_key
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    {retailer.retailer_logo_url && (
                      <img
                        src={retailer.retailer_logo_url}
                        alt={retailer.name}
                        className="w-12 h-12 object-contain flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900">{retailer.name}</h4>
                      <p className="text-sm text-gray-500 truncate">{retailer.retailer_key}</p>
                    </div>
                    {selectedRetailer?.retailer_key === retailer.retailer_key && (
                      <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 border-t pt-4">
            {!currentRetailer && (
              <button
                onClick={handleSkip}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Skip for Now
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            {selectedRetailer && (
              <>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Use This Time</span>
                  )}
                </button>
                <button
                  onClick={handleSetAsPrimary}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Star className="w-4 h-4" />
                      <span>Set as Primary</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
