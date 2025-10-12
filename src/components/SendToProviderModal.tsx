import React, { useState, useEffect } from 'react';
import { X, ShoppingCart, ExternalLink, AlertCircle, CheckCircle, Loader2, Store, MapPin } from 'lucide-react';
import type { ShoppingItem, ProviderName, UserPreferredRetailer } from '../lib/supabase';
import { instacartShoppingService } from '../services/instacartShoppingService';
import { RetailerSelectionModal } from './RetailerSelectionModal';
import { InstacartButton } from './InstacartButton';

interface SendToProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ShoppingItem[];
  provider: ProviderName;
  onConfirm: (items: ShoppingItem[], retailerKey?: string) => Promise<void>;
  userId: string;
}

export function SendToProviderModal({
  isOpen,
  onClose,
  items,
  provider,
  onConfirm,
  userId,
}: SendToProviderModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cartUrl, setCartUrl] = useState<string | null>(null);
  const [primaryRetailer, setPrimaryRetailer] = useState<UserPreferredRetailer | null>(null);
  const [selectedRetailer, setSelectedRetailer] = useState<UserPreferredRetailer | null>(null);
  const [showRetailerModal, setShowRetailerModal] = useState(false);
  const [loadingRetailer, setLoadingRetailer] = useState(false);

  const providerDisplay = {
    instacart: { name: 'Instacart', color: 'bg-green-500', textColor: 'text-green-600' },
    amazon: { name: 'Amazon', color: 'bg-orange-500', textColor: 'text-orange-600' },
    manual: { name: 'Manual', color: 'bg-gray-500', textColor: 'text-gray-600' },
  };

  const currentProvider = provider ? providerDisplay[provider] : null;

  const itemsAlreadyInCart = items.filter(
    item => item.provider_name === provider && item.purchase_status === 'in_cart'
  );

  useEffect(() => {
    if (isOpen && provider === 'instacart' && userId) {
      loadPrimaryRetailer();
    }
  }, [isOpen, provider, userId]);

  const loadPrimaryRetailer = async () => {
    setLoadingRetailer(true);
    try {
      const retailer = await instacartShoppingService.getPrimaryRetailer(userId);
      setPrimaryRetailer(retailer);
      setSelectedRetailer(retailer);
    } catch (err) {
      console.error('Failed to load primary retailer:', err);
    } finally {
      setLoadingRetailer(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const retailerKey = provider === 'instacart' ? selectedRetailer?.retailer_key : undefined;
      await onConfirm(items, retailerKey);
      setSuccess(true);

      if (items.length > 0 && items[0].provider_metadata?.cart_url) {
        setCartUrl(items[0].provider_metadata.cart_url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send items to provider');
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLoading(false);
    setError(null);
    setSuccess(false);
    setCartUrl(null);
    setPrimaryRetailer(null);
    setSelectedRetailer(null);
    setShowRetailerModal(false);
    onClose();
  };

  const handleRetailerSelected = (retailer: UserPreferredRetailer | null) => {
    setSelectedRetailer(retailer);
    setShowRetailerModal(false);
  };

  const handleViewCart = () => {
    if (cartUrl) {
      window.open(cartUrl, '_blank', 'noopener,noreferrer');
    }
    handleClose();
  };

  if (!isOpen || !currentProvider) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              {provider === 'instacart' ? (
                <img
                  src="/Instacart_Logo_Kale.svg"
                  alt="Instacart"
                  className="h-8 w-auto"
                />
              ) : (
                <div className={`w-10 h-10 ${currentProvider.color} rounded-full flex items-center justify-center`}>
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                  {success ? 'Items Sent!' : `Send to ${currentProvider.name}`}
                </h2>
                <p className="text-sm text-gray-600">
                  {success ? 'Successfully added to cart' : `${items.length} item${items.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {!success ? (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 font-medium">Error</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {provider === 'instacart' && !loadingRetailer && (
                <div className="mb-4">
                  {selectedRetailer ? (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {selectedRetailer.retailer_logo_url && (
                            <img
                              src={selectedRetailer.retailer_logo_url}
                              alt={selectedRetailer.retailer_name}
                              className="w-10 h-10 object-contain"
                            />
                          )}
                          <div>
                            <p className="text-sm font-medium text-green-900">
                              {selectedRetailer.retailer_name}
                            </p>
                            <p className="text-xs text-green-700">
                              {selectedRetailer.is_primary ? 'Your primary retailer' : 'Selected retailer'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowRetailerModal(true)}
                          className="text-sm text-green-700 hover:text-green-800 font-medium"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <Store className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-blue-800 font-medium">
                            No retailer selected
                          </p>
                          <p className="text-sm text-blue-700 mt-1">
                            Choose a retailer to get the best shopping experience.
                          </p>
                          <button
                            onClick={() => setShowRetailerModal(true)}
                            className="mt-2 text-sm text-blue-700 hover:text-blue-800 font-medium flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3" />
                            Select a retailer
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {itemsAlreadyInCart.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-yellow-800 font-medium">
                        {itemsAlreadyInCart.length} item{itemsAlreadyInCart.length !== 1 ? 's' : ''} already in {currentProvider.name} cart
                      </p>
                      <p className="text-sm text-yellow-700 mt-1">
                        These items will be updated with the new cart information.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-6 max-h-60 overflow-y-auto">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Items to send:</h3>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{item.item}</p>
                        <p className="text-xs text-gray-600">
                          {item.category} {item.quantity && item.quantity > 1 ? `(${item.quantity})` : ''}
                        </p>
                      </div>
                      {item.provider_name === provider && item.purchase_status === 'in_cart' && (
                        <div className="text-xs text-yellow-600 font-medium">
                          Already in cart
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm sm:text-base"
                >
                  Cancel
                </button>
                {provider === 'instacart' ? (
                  <InstacartButton
                    variant="dark"
                    text="Order with Instacart"
                    onClick={handleConfirm}
                    disabled={loading}
                    loading={loading}
                    fullWidth
                  />
                ) : (
                  <button
                    onClick={handleConfirm}
                    disabled={loading}
                    className={`flex-1 px-4 py-2 ${currentProvider.color} text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm sm:text-base flex items-center justify-center space-x-2`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <span>Confirm Send</span>
                    )}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-center text-gray-700">
                  Your items have been successfully added to your {currentProvider.name} cart!
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
                >
                  Close
                </button>
                {cartUrl && provider === 'instacart' && (
                  <InstacartButton
                    variant="dark"
                    text="Shop with Instacart"
                    onClick={handleViewCart}
                    fullWidth
                  />
                )}
                {cartUrl && provider !== 'instacart' && (
                  <button
                    onClick={handleViewCart}
                    className={`flex-1 px-4 py-2 ${currentProvider.color} text-white rounded-lg hover:opacity-90 transition-opacity text-sm sm:text-base flex items-center justify-center space-x-2`}
                  >
                    <span>View on {currentProvider.name}</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <RetailerSelectionModal
        isOpen={showRetailerModal}
        onClose={() => setShowRetailerModal(false)}
        userId={userId}
        onRetailerSelected={handleRetailerSelected}
        currentRetailer={primaryRetailer}
      />
    </div>
  );
}
