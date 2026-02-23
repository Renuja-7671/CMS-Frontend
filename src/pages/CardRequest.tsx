import { useState, useEffect } from 'react';
import { FileText, Lock, Calendar, RefreshCw, CheckCircle2, AlertCircle, Check, X, Search } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Pagination } from '../components/ui/pagination';
import { cardService, cardRequestService, type CardDTO } from '../services/cardService';
import type { CreateCardRequestDTO, CardRequestDTO, PageResponse } from '../types/card';
import { handleApiError } from '../utils/errorHandler';
import { getActiveUsers } from '../services/userService';
import type { UserDTO } from '../types/user';

export default function CardRequest() {
  const [cards, setCards] = useState<CardDTO[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IACT' | 'CACT' | 'DACT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [paginationInfo, setPaginationInfo] = useState<PageResponse<CardDTO> | null>(null);
  
  // Pending requests state
  const [pendingRequests, setPendingRequests] = useState<CardRequestDTO[]>([]);
  
  // User selection state
  const [activeUsers, setActiveUsers] = useState<UserDTO[]>([]);
  const [selectedRequestedUser, setSelectedRequestedUser] = useState<string>('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  // Dialog state
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardDTO | null>(null);
  const [requestAction, setRequestAction] = useState<'ACTI' | 'CDCL' | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Status message
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  // Fetch all cards with pagination and filters
  const fetchCards = async () => {
    setIsLoadingCards(true);
    setCardsError(null);
    try {
      const response = await cardService.getAllCardsPaginated(currentPage, pageSize, statusFilter, searchQuery);
      setPaginationInfo(response.data);
      setCards(response.data.content || []);
    } catch (error) {
      setCardsError(handleApiError(error, 'Fetch Cards'));
    } finally {
      setIsLoadingCards(false);
    }
  };

  // Fetch pending requests
  const fetchPendingRequests = async () => {
    try {
      const response = await cardRequestService.getAllCardRequests();
      // Filter only pending requests (status = 'PEND')
      const pending = (response.data || []).filter(req => req.requestStatus === 'PEND');
      setPendingRequests(pending);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      // Don't show error to user - this is not critical
      // Set empty array to allow the page to continue functioning
      setPendingRequests([]);
    }
  };

  // Fetch cards when page, page size, status filter, or search query changes
  // Reset to page 0 when filters change
  useEffect(() => {
    if (currentPage === 0) {
      fetchCards();
    } else {
      setCurrentPage(0); // This will trigger the effect again with page 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchQuery]);

  // Fetch cards when page or page size changes
  useEffect(() => {
    fetchCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  // Fetch pending requests on mount
  useEffect(() => {
    fetchPendingRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch active users on mount
  useEffect(() => {
    const loadActiveUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const users = await getActiveUsers();
        setActiveUsers(users);
        // Auto-select first user if available
        if (users.length > 0) {
          setSelectedRequestedUser(users[0].userName);
        }
      } catch (error) {
        console.error('Error loading active users:', error);
        setActiveUsers([]);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    
    loadActiveUsers();
  }, []);

  // Check if a card has a pending request
  const hasPendingRequest = (displayCardNumber: string): boolean => {
    try {
      return pendingRequests.some(req => req.displayCardNumber === displayCardNumber);
    } catch (error) {
      // If there's any error checking pending requests, default to false
      if (import.meta.env.DEV) {
        console.warn('Error checking pending request:', error);
      }
      return false;
    }
  };

  // Format card number for display
  const formatDisplayCardNumber = (displayCardNumber: string) => {
    try {
      if (!displayCardNumber || displayCardNumber.length < 10) {
        return displayCardNumber || 'N/A';
      }
      
      const first6 = displayCardNumber.substring(0, 6);
      const last4 = displayCardNumber.substring(displayCardNumber.length - 4);
      const masked = `${first6.substring(0, 4)} ${first6.substring(4, 6)}XX XXXX ${last4}`;
      
      return masked;
    } catch (error) {
      // If formatting fails, return the original or a safe default
      if (import.meta.env.DEV) {
        console.warn('Error formatting card number:', error);
      }
      return displayCardNumber || 'N/A';
    }
  };

  // Safely format date
  const formatDate = (dateString: string, includeDay = false) => {
    try {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      if (includeDay) {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Error formatting date:', error);
      }
      return 'N/A';
    }
  };

  // Safely format currency
  const formatCurrency = (amount: number | null | undefined) => {
    try {
      if (amount === null || amount === undefined || isNaN(amount)) return '0';
      return amount.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Error formatting currency:', error);
      }
      return '0';
    }
  };

  // Handle activate/deactivate button click
  const handleRequestClick = (card: CardDTO, action: 'ACTI' | 'CDCL') => {
    try {
      // Validate card object
      if (!card || !card.displayCardNumber) {
        setSubmitStatus({
          type: 'error',
          message: 'Invalid card data. Please refresh the page and try again.',
        });
        setTimeout(() => setSubmitStatus({ type: null, message: '' }), 5000);
        return;
      }

      // Check if card already has a pending request
      if (hasPendingRequest(card.displayCardNumber)) {
        setSubmitStatus({
          type: 'error',
          message: 'This card already has a pending request. Please wait for the previous request to be processed.',
        });
        setTimeout(() => setSubmitStatus({ type: null, message: '' }), 5000);
        return;
      }

      // For deactivation, check if credit limit equals available credit limit
      if (action === 'CDCL') {
        const creditLimit = card.creditLimit ?? 0;
        const availableCredit = card.availableCreditLimit ?? 0;
        
        if (creditLimit !== availableCredit) {
          setSubmitStatus({
            type: 'error',
            message: 'Cannot deactivate card. Outstanding balance exists. Please clear all dues before deactivation.',
          });
          setTimeout(() => setSubmitStatus({ type: null, message: '' }), 5000);
          return;
        }
      }
      
      setSelectedCard(card);
      setRequestAction(action);
      setRequestReason(''); // Reset reason when opening dialog
      setIsConfirmDialogOpen(true);
    } catch (error) {
      // Catch any unexpected errors in the click handler
      const errorMessage = handleApiError(error, 'Handle Request Click');
      setSubmitStatus({
        type: 'error',
        message: errorMessage,
      });
      setTimeout(() => setSubmitStatus({ type: null, message: '' }), 5000);
    }
  };

  // Submit card request
  const handleConfirmRequest = async () => {
    if (!selectedCard || !requestAction) {
      setSubmitStatus({
        type: 'error',
        message: 'Invalid request data. Please try again.',
      });
      setIsConfirmDialogOpen(false);
      setTimeout(() => setSubmitStatus({ type: null, message: '' }), 3000);
      return;
    }

    // Validate required fields
    if (!selectedCard.displayCardNumber || !selectedCard.encryptionKey) {
      setSubmitStatus({
        type: 'error',
        message: 'Missing required card information. Please refresh and try again.',
      });
      setIsConfirmDialogOpen(false);
      setTimeout(() => setSubmitStatus({ type: null, message: '' }), 3000);
      return;
    }

    // Validate reason is provided
    if (!requestReason || requestReason.trim().length === 0) {
      setSubmitStatus({
        type: 'error',
        message: 'Please provide a reason for this request.',
      });
      setTimeout(() => setSubmitStatus({ type: null, message: '' }), 3000);
      return;
    }

    // Validate user is selected
    if (!selectedRequestedUser || selectedRequestedUser.trim().length === 0) {
      setSubmitStatus({
        type: 'error',
        message: 'Please select a user to create the request.',
      });
      setTimeout(() => setSubmitStatus({ type: null, message: '' }), 3000);
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      const requestPayload: CreateCardRequestDTO = {
        displayCardNumber: selectedCard.displayCardNumber,
        encryptionKey: selectedCard.encryptionKey,
        requestType: requestAction,
        reason: requestReason.trim(),
        requestedUser: selectedRequestedUser,
      };

      const response = await cardRequestService.createCardRequest(requestPayload);
      
      setSubmitStatus({
        type: 'success',
        message: response.message || `Card ${requestAction === 'ACTI' ? 'activation' : 'deactivation'} request submitted successfully!`,
      });

      // Close dialog and refresh cards and pending requests
      setIsConfirmDialogOpen(false);
      setSelectedCard(null);
      setRequestAction(null);
      setRequestReason('');
      
      // Refresh data in the background
      Promise.all([fetchCards(), fetchPendingRequests()]).catch(error => {
        if (import.meta.env.DEV) {
          console.warn('Error refreshing data after request submission:', error);
        }
      });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSubmitStatus({ type: null, message: '' });
      }, 3000);
    } catch (error) {
      const errorMessage = handleApiError(error, 'Create Card Request');
      
      setSubmitStatus({
        type: 'error',
        message: errorMessage,
      });
      
      // Close dialog on error
      setIsConfirmDialogOpen(false);
      setSelectedCard(null);
      setRequestAction(null);
      setRequestReason('');
      
      // Auto-clear error after 5 seconds
      setTimeout(() => {
        setSubmitStatus({ type: null, message: '' });
      }, 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get button text and variant based on card status
  const getActionButton = (card: CardDTO) => {
    try {
      if (!card || !card.displayCardNumber) {
        return null;
      }

      const hasPending = hasPendingRequest(card.displayCardNumber);
      
      if (card.cardStatus === 'CACT') {
        return (
          <Button
            onClick={() => handleRequestClick(card, 'CDCL')}
            variant="outline"
            size="sm"
            disabled={hasPending}
            className={`h-8 px-3 ${hasPending ? 'opacity-50 cursor-not-allowed' : 'border-red-600 text-red-600 hover:bg-red-50'}`}
            title={hasPending ? 'Pending request exists' : 'Request deactivation'}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            {hasPending ? 'Pending' : 'Deactivate'}
          </Button>
        );
      } else if (card.cardStatus === 'IACT' || card.cardStatus === 'DACT') {
        return (
          <Button
            onClick={() => handleRequestClick(card, 'ACTI')}
            variant="outline"
            size="sm"
            disabled={hasPending}
            className={`h-8 px-3 ${hasPending ? 'opacity-50 cursor-not-allowed' : 'border-green-600 text-green-600 hover:bg-green-50'}`}
            title={hasPending ? 'Pending request exists' : 'Request activation'}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            {hasPending ? 'Pending' : 'Activate'}
          </Button>
        );
      }
      return null;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Error rendering action button:', error);
      }
      return null;
    }
  };

  return (
    <div>
      {/* Status Message - Top Right Banner */}
      {submitStatus.type && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl flex items-center gap-3 shadow-lg min-w-[320px] max-w-md animate-slide-in-right ${
            submitStatus.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {submitStatus.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
          )}
          <p className="font-medium flex-1">{submitStatus.message}</p>
        </div>
      )}

      {/* Cards List Section */}
      <Card className="shadow-sm border border-gray-200 bg-white rounded-xl overflow-hidden">
        <CardHeader className="bg-blue-900 text-white">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl text-white">Card Request Management</CardTitle>
              <CardDescription className="text-blue-100">
                Request activation or deactivation for cards
              </CardDescription>
            </div>
            <Button
              onClick={fetchCards}
              disabled={isLoadingCards}
              variant="secondary"
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingCards ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        {/* Filter Tabs */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Filter by Status:</span>
              <div className="flex gap-2">
                <Button
                  onClick={() => setStatusFilter('ALL')}
                  variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                  size="sm"
                  className={statusFilter === 'ALL' ? 'bg-blue-900 hover:bg-blue-950' : 'hover:bg-gray-100'}
                >
                  All Cards ({cards.length})
                </Button>
                <Button
                  onClick={() => setStatusFilter('IACT')}
                  variant={statusFilter === 'IACT' ? 'default' : 'outline'}
                  size="sm"
                  className={statusFilter === 'IACT' ? 'bg-blue-900 hover:bg-blue-950' : 'hover:bg-gray-100'}
                >
                  Inactive
                </Button>
                <Button
                  onClick={() => setStatusFilter('CACT')}
                  variant={statusFilter === 'CACT' ? 'default' : 'outline'}
                  size="sm"
                  className={statusFilter === 'CACT' ? 'bg-blue-900 hover:bg-blue-950' : 'hover:bg-gray-100'}
                >
                  Active
                </Button>
                <Button
                  onClick={() => setStatusFilter('DACT')}
                  variant={statusFilter === 'DACT' ? 'default' : 'outline'}
                  size="sm"
                  className={statusFilter === 'DACT' ? 'bg-blue-900 hover:bg-blue-950' : 'hover:bg-gray-100'}
                >
                  Deactivated
                </Button>
              </div>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by card number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9"
            />
          </div>
        </div>

        <CardContent className="p-0">
          {cardsError && (
            <div className="p-6 bg-red-50 text-red-800 border-b border-red-200">
              <AlertCircle className="h-5 w-5 inline mr-2" />
              {cardsError}
            </div>
          )}
          
          {isLoadingCards ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-gray-600">Loading cards...</p>
            </div>
          ) : cards.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No cards found</p>
              <p className="text-sm">
                {searchQuery.trim() 
                  ? `No cards match "${searchQuery}"` 
                  : statusFilter === 'ALL' 
                  ? 'No cards available in the system' 
                  : `No ${statusFilter === 'IACT' ? 'inactive' : statusFilter === 'CACT' ? 'active' : 'deactivated'} cards found`}
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-3">
              {cards.map((card, index) => (
                <div 
                  key={index} 
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Card Number */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Lock className="h-4 w-4 text-gray-400" />
                      <span className="font-mono font-bold text-gray-900 text-sm">
                        {formatDisplayCardNumber(card.displayCardNumber)}
                      </span>
                    </div>

                    {/* Expiry Date */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Calendar className="h-3.5 w-3.5 text-gray-500" />
                      <span className="text-sm text-gray-700">
                        {formatDate(card.expiryDate)}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex-shrink-0">
                      <Badge
                        variant={
                          card.cardStatus === 'CACT'
                            ? 'success'
                            : card.cardStatus === 'DACT'
                            ? 'destructive'
                            : 'inactive'
                        }
                        className="text-xs py-1 px-3"
                      >
                        {card.cardStatus === 'CACT'
                          ? 'Active'
                          : card.cardStatus === 'DACT'
                          ? 'Deactivated'
                          : 'Inactive'}
                      </Badge>
                    </div>

                    {/* Credit Limit */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-gray-500">Credit</div>
                      <div className="font-semibold text-gray-900 text-sm">
                        {formatCurrency(card.creditLimit)}
                      </div>
                    </div>

                    {/* Available Credit */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-gray-500">Avail. Credit</div>
                      <div className="font-semibold text-blue-900 text-sm">
                        {formatCurrency(card.availableCreditLimit)}
                      </div>
                    </div>

                    {/* Cash Limit */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-gray-500">Cash</div>
                      <div className="font-semibold text-gray-900 text-sm">
                        {formatCurrency(card.cashLimit)}
                      </div>
                    </div>

                    {/* Available Cash */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-gray-500">Avail. Cash</div>
                      <div className="font-semibold text-blue-900 text-sm">
                        {formatCurrency(card.availableCashLimit)}
                      </div>
                    </div>

                    {/* Last Updated */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-gray-500">Updated</div>
                      <div className="text-sm font-medium text-gray-700">
                        {formatDate(card.lastUpdateTime, true)}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="flex-shrink-0">
                      {getActionButton(card)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        
        {/* Pagination */}
        {paginationInfo && paginationInfo.totalElements > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={paginationInfo.totalPages}
            onPageChange={(page) => setCurrentPage(page)}
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(0);
            }}
            totalElements={paginationInfo.totalElements}
            hasNext={paginationInfo.hasNext}
            hasPrevious={paginationInfo.hasPrevious}
          />
        )}
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsConfirmDialogOpen(false);
          setSelectedCard(null);
          setRequestAction(null);
          setRequestReason('');
        }
      }}>
        <DialogContent className="sm:max-w-[500px] p-0">
          <DialogClose onClose={() => {
            setIsConfirmDialogOpen(false);
            setSelectedCard(null);
            setRequestAction(null);
            setRequestReason('');
          }} />
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Confirm {requestAction === 'ACTI' ? 'Activation' : 'Deactivation'} Request
            </DialogTitle>
          </DialogHeader>
          
          {selectedCard && (
            <div className="px-6 pb-6 space-y-4">
              {/* Card Details */}
              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Card Number:</span>
                  <span className="font-mono font-semibold text-gray-900">
                    {formatDisplayCardNumber(selectedCard.displayCardNumber)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Current Status:</span>
                  <Badge
                    variant={
                      selectedCard.cardStatus === 'CACT'
                        ? 'success'
                        : selectedCard.cardStatus === 'DACT'
                        ? 'destructive'
                        : 'inactive'
                    }
                    className="text-xs"
                  >
                    {selectedCard.cardStatus === 'CACT'
                      ? 'Active'
                      : selectedCard.cardStatus === 'DACT'
                      ? 'Deactivated'
                      : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Request Type:</span>
                  <Badge
                    variant={requestAction === 'ACTI' ? 'success' : 'destructive'}
                    className="text-xs"
                  >
                    {requestAction === 'ACTI' ? 'Activation' : 'Deactivation'}
                  </Badge>
                </div>
              </div>

              {/* Reason/Remark Field */}
              <div className="space-y-2">
                <Label htmlFor="request-reason" className="text-sm font-semibold text-gray-700">
                  Reason for Request <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="request-reason"
                  placeholder="Please provide a reason for this request..."
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="min-h-[100px] resize-none"
                  disabled={isSubmitting}
                  maxLength={500}
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Required field - Please explain why this request is needed</span>
                  <span>{requestReason.length}/500</span>
                </div>
              </div>

              {/* User Selection Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="requestedUser" className="text-sm font-semibold text-gray-700">
                  Requested By <span className="text-red-500">*</span>
                </Label>
                <select
                  id="requestedUser"
                  value={selectedRequestedUser}
                  onChange={(e) => setSelectedRequestedUser(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={isSubmitting || isLoadingUsers}
                  required
                >
                  <option value="">-- Select User --</option>
                  {activeUsers.map((user) => (
                    <option key={user.userName} value={user.userName}>
                      {user.name} ({user.userName})
                    </option>
                  ))}
                </select>
                {isLoadingUsers && (
                  <p className="text-xs text-gray-500">Loading users...</p>
                )}
                {!isLoadingUsers && activeUsers.length === 0 && (
                  <p className="text-xs text-red-500">No active users available</p>
                )}
              </div>

              {/* Warning message for deactivation */}
              {requestAction === 'CDCL' && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-semibold">Important:</p>
                      <p>This will submit a deactivation request for this card. The card status will change to Inactive pending approval.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Info message for activation */}
              {requestAction === 'ACTI' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex gap-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold">Activation Request:</p>
                      <p>This will submit an activation request for this card. The request will be pending approval.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsConfirmDialogOpen(false);
                    setSelectedCard(null);
                    setRequestAction(null);
                    setRequestReason('');
                  }}
                  disabled={isSubmitting}
                  className="flex-1 h-10 border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmRequest}
                  disabled={isSubmitting || !requestReason.trim() || !selectedRequestedUser}
                  className={`flex-1 h-10 ${
                    requestAction === 'ACTI'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Submitting...
                    </>
                  ) : (
                    `Confirm ${requestAction === 'ACTI' ? 'Activation' : 'Deactivation'}`
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
