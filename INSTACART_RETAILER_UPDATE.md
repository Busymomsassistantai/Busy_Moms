# Instacart Retailer Integration Update

## Summary
Updated the Instacart shopping cart functionality to include preferred retailer support. Users can now specify which retailer they want to shop at when sending items to Instacart.

## Changes Made

### 1. Service Layer Updates (`instacartShoppingService.ts`)
- Added optional `retailerKey` parameter to `sendToInstacart()`, `sendAllToInstacart()`, and `sendSelectedToInstacart()` methods
- Modified `updateItemsProviderStatus()` to store retailer information (retailer_key and retailer_name) in provider_metadata
- Service automatically retrieves retailer name when a retailer_key is provided

### 2. Edge Function Updates (`instacart-shopping-list/index.ts`)
- Added `retailer_key` field to `CreateShoppingListRequest` interface
- Updated the Instacart API payload to include retailer_key when provided
- Retailer key is now sent to Instacart API for targeted shopping

### 3. New RetailerSelectionModal Component
- Created a modal that allows users to search for nearby retailers by postal code
- Displays available retailers with logos and names
- Users can select a retailer for one-time use or set it as their primary retailer
- Shows current primary retailer if one is set
- Provides skip option if no retailer is needed

### 4. SendToProviderModal Enhancements
- Loads user's primary retailer automatically when modal opens for Instacart
- Displays selected retailer prominently with logo and name
- Shows informative message if no retailer is selected
- Allows users to change retailer selection via "Change" button
- Integrates RetailerSelectionModal for seamless retailer selection
- Passes retailer_key to confirmation handler

### 5. Shopping Component Updates
- Updated to pass `userId` to SendToProviderModal
- Modified `handleConfirmSend()` to accept and forward retailer_key parameter
- Added Store icon import for UI enhancements
- Displays retailer name badge on shopping list items that have been sent to a specific retailer
- Shows retailer information alongside provider badges

## User Experience Flow

### With Primary Retailer Set
1. User clicks "Send to Instacart"
2. Modal opens showing their primary retailer
3. User can proceed with that retailer or change it
4. Items are sent to the selected retailer

### Without Primary Retailer
1. User clicks "Send to Instacart"
2. Modal opens with option to select a retailer
3. User can search by postal code to find nearby retailers
4. User selects a retailer (one-time or set as primary)
5. Items are sent to the selected retailer

### Viewing Cart
- Items display retailer name badge when sent to a specific retailer
- "View Cart" link opens the cart with items at the selected retailer
- Retailer information is stored in provider_metadata for reference

## Database Integration
Uses existing `user_preferred_retailers` table:
- Stores retailer preferences per user
- Tracks primary retailer with `is_primary` flag
- Maintains retailer_key, retailer_name, and retailer_logo_url

## API Integration
- Retailer key is passed to Instacart API via the products_link endpoint
- Instacart returns retailer-specific cart URL
- Cart URL is stored in provider_metadata for easy access

## Benefits
1. Better shopping experience - users shop at their preferred store
2. Accurate pricing - prices reflect the selected retailer
3. Inventory accuracy - items available at the chosen location
4. Convenience - primary retailer setting reduces friction
5. Transparency - users always know which retailer will fulfill their order
