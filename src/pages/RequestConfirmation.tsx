import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { cardRequestService } from '../services/cardService';
import type { CardRequestDetailDTO } from '../types/card';
import { handleApiError, logError } from '../utils/errorHandler';

type ActionType = 'approve' | 'reject';

interface ConfirmDialogState {
  isOpen: boolean;
  request: CardRequestDetailDTO | null;
  action: ActionType | null;
}

interface DetailsDialogState {
  isOpen: boolean;
  request: CardRequestDetailDTO | null;
}

const RequestConfirmation = () => {
  const [requests, setRequests] = useState<CardRequestDetailDTO[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<CardRequestDetailDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [requestTypeFilter, setRequestTypeFilter] = useState<'ALL' | 'ACTI' | 'CDCL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    request: null,
    action: null,
  });
  const [detailsDialog, setDetailsDialog] = useState<DetailsDialogState>({
    isOpen: false,
    request: null,
  });

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  // Filter requests based on request type and search query
  useEffect(() => {
    let filtered = requests;
    
    // Filter by request type
    if (requestTypeFilter !== 'ALL') {
      filtered = filtered.filter(req => req.requestType === requestTypeFilter);
    }
    
    // Filter by search query (card number)
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(req => 
        req.displayCardNumber?.toLowerCase().includes(query)
      );
    }
    
    setFilteredRequests(filtered);
  }, [requests, requestTypeFilter, searchQuery]);

  const fetchPendingRequests = async () => {
    try {
      setIsLoading(true);
      const response = await cardRequestService.getPendingRequestsWithDetails();
      setRequests(response.data || []);
    } catch (error) {
      handleApiError(error, 'Failed to load pending requests');
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (request: CardRequestDetailDTO, action: ActionType) => {
    try {
      if (!request || !request.requestId) {
        if (import.meta.env.DEV) {
          console.warn('Invalid request data for action');
        }
        return;
      }
      setConfirmDialog({ isOpen: true, request, action });
    } catch (error) {
      logError(error, 'Error preparing action dialog');
    }
  };

  const handleConfirmAction = async () => {
    const { request, action } = confirmDialog;
    
    try {
      if (!request || !request.requestId || !action) {
        if (import.meta.env.DEV) {
          console.warn('Invalid confirmation dialog state');
        }
        return;
      }

      if (action === 'approve') {
        await cardRequestService.approveRequest(request.requestId);
      } else {
        await cardRequestService.rejectRequest(request.requestId);
      }

      // Close dialog
      setConfirmDialog({ isOpen: false, request: null, action: null });

      // Refresh the list in background (don't await to avoid blocking UI)
      Promise.all([fetchPendingRequests()]).catch((error) => {
        if (import.meta.env.DEV) {
          console.warn('Background refresh failed:', error);
        }
      });
    } catch (error) {
      handleApiError(error, `Failed to ${action} request`);
    }
  };

  const formatDisplayCardNumber = (displayNumber: string | null | undefined): string => {
    try {
      if (!displayNumber || typeof displayNumber !== 'string') {
        return 'N/A';
      }
      // Mask the middle section: show first 4 and last 4 digits
      if (displayNumber.length >= 8) {
        const first4 = displayNumber.substring(0, 4);
        const last4 = displayNumber.substring(displayNumber.length - 4);
        return `${first4} **** **** ${last4}`;
      }
      return displayNumber;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Error formatting card number:', error);
      }
      return 'N/A';
    }
  };

  const formatDate = (dateString: string | null | undefined, includeDay: boolean = false): string => {
    try {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      
      const options: Intl.DateTimeFormatOptions = includeDay 
        ? { year: 'numeric', month: 'short', day: 'numeric' }
        : { year: 'numeric', month: 'short' };
      
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Error formatting date:', error);
      }
      return 'N/A';
    }
  };

  const formatDateTime = (dateString: string | null | undefined): string => {
    try {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      
      return date.toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Error formatting date time:', error);
      }
      return 'N/A';
    }
  };

  const formatCurrency = (amount: number | null | undefined): string => {
    try {
      if (amount === null || amount === undefined || typeof amount !== 'number') {
        return '0';
      }
      return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Error formatting currency:', error);
      }
      return '0';
    }
  };

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    try {
      if (!status) return 'default';
      
      switch (status.toUpperCase()) {
        case 'IACT':
        case 'DACT':
          return 'secondary';
        case 'CACT':
          return 'default';
        default:
          return 'outline';
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Error determining badge variant:', error);
      }
      return 'default';
    }
  };

  const getStatusLabel = (status: string): string => {
    try {
      if (!status) return 'Unknown';
      
      switch (status.toUpperCase()) {
        case 'IACT':
          return 'Inactive';
        case 'CACT':
          return 'Active';
        case 'DACT':
          return 'Deactivated';
        default:
          return status;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Error determining status label:', error);
      }
      return status;
    }
  };

  const getRequestTypeBadgeVariant = (type: string): 'default' | 'secondary' => {
    try {
      if (!type) return 'default';
      return type === 'ACTI' ? 'default' : 'secondary';
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Error determining request type badge variant:', error);
      }
      return 'default';
    }
  };

  const getActionText = (requestType: string, action: ActionType): string => {
    try {
      if (action === 'approve') {
        return requestType === 'ACTI' ? 'Activate Card' : 'Deactivate Card';
      } else {
        return requestType === 'ACTI' ? 'Keep Deactivated' : 'Keep Active';
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Error determining action text:', error);
      }
      return action === 'approve' ? 'Approve' : 'Reject';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading pending requests...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card className="shadow-sm border border-gray-200 bg-white rounded-xl overflow-hidden">
        <CardHeader className="bg-blue-900 text-white">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl text-white">Request Confirmation</CardTitle>
              <CardDescription className="text-blue-100">
                Review and process pending card activation/deactivation requests
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {/* Filter Section */}
        {requests.length > 0 && (
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Filter by Request Type:</span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setRequestTypeFilter('ALL')}
                    variant={requestTypeFilter === 'ALL' ? 'default' : 'outline'}
                    size="sm"
                    className={requestTypeFilter === 'ALL' ? 'bg-blue-900 hover:bg-blue-950' : 'hover:bg-gray-100'}
                  >
                    All Requests ({requests.length})
                  </Button>
                  <Button
                    onClick={() => setRequestTypeFilter('ACTI')}
                    variant={requestTypeFilter === 'ACTI' ? 'default' : 'outline'}
                    size="sm"
                    className={requestTypeFilter === 'ACTI' ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-green-50 text-green-700 border-green-300'}
                  >
                    Activation ({requests.filter(r => r.requestType === 'ACTI').length})
                  </Button>
                  <Button
                    onClick={() => setRequestTypeFilter('CDCL')}
                    variant={requestTypeFilter === 'CDCL' ? 'default' : 'outline'}
                    size="sm"
                    className={requestTypeFilter === 'CDCL' ? 'bg-orange-600 hover:bg-orange-700' : 'hover:bg-orange-50 text-orange-700 border-orange-300'}
                  >
                    Deactivation ({requests.filter(r => r.requestType === 'CDCL').length})
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
        )}

        <CardContent className="p-0">
          {requests.length === 0 ? (
            <div className="py-12">
              <div className="text-center text-gray-500">
                <p className="text-lg font-medium">No pending requests</p>
                <p className="text-sm mt-1">All requests have been processed</p>
              </div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-12">
              <div className="text-center text-gray-500">
                {searchQuery.trim() ? (
                  <>
                    <p className="text-lg font-medium">No matching requests found</p>
                    <p className="text-sm mt-1">No requests match "{searchQuery}"</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium">No {requestTypeFilter === 'ACTI' ? 'activation' : 'deactivation'} requests</p>
                    <p className="text-sm mt-1">No pending {requestTypeFilter === 'ACTI' ? 'activation' : 'deactivation'} requests found</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-3">
              {filteredRequests.map((request) => (
                <div 
                  key={request.requestId} 
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex items-center justify-between gap-3">
                  {/* Request ID and Type */}
                  <div className="flex items-center gap-3 min-w-[140px]">
                    <div>
                      <div className="text-xs text-gray-500">Request #{request.requestId}</div>
                      <Badge 
                        variant={getRequestTypeBadgeVariant(request.requestType)}
                        className="mt-1"
                      >
                        {request.requestType === 'ACTI' ? 'Activation' : 'Deactivation'}
                      </Badge>
                    </div>
                  </div>

                  {/* Card Number */}
                  <div className="flex items-center gap-2 min-w-[180px]">
                    <span className="font-mono text-sm font-medium text-gray-900">
                      {formatDisplayCardNumber(request.displayCardNumber)}
                    </span>
                  </div>

                  {/* Card Status Badge */}
                  <div className="min-w-[140px]">
                    <Badge 
                      variant={getStatusBadgeVariant(request.cardStatus)} 
                      className="text-xs px-3 py-1"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        <span>{getStatusLabel(request.cardStatus)}</span>
                      </span>
                    </Badge>
                  </div>

                  {/* Request Date */}
                  <div className="text-sm text-gray-600 min-w-[140px]">
                    {formatDate(request.requestedAt, true)}
                  </div>

                  {/* Reason Preview */}
                  {request.reason && (
                    <div className="flex-1 min-w-[200px] max-w-[300px]">
                      <p className="text-sm text-gray-600 truncate" title={request.reason}>
                        {request.reason}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailsDialog({ isOpen: true, request })}
                      className="min-w-[80px]"
                    >
                      Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction(request, 'reject')}
                      className="min-w-[80px] text-red-600 hover:bg-red-50 border-red-300"
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAction(request, 'approve')}
                      className="min-w-[80px] bg-green-600 hover:bg-green-700"
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

      {/* Details Dialog */}
      <Dialog open={detailsDialog.isOpen} onOpenChange={(open) => {
        if (!open) {
          setDetailsDialog({ isOpen: false, request: null });
        }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Request Details - #{detailsDialog.request?.requestId}
            </DialogTitle>
          </DialogHeader>
          
          {detailsDialog.request && (
            <div className="space-y-4 px-5 pb-4">
              {/* Request Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm text-gray-600">Request Type:</span>
                  <div className="mt-1">
                    <Badge variant={getRequestTypeBadgeVariant(detailsDialog.request.requestType)}>
                      {detailsDialog.request.requestTypeDescription || detailsDialog.request.requestType}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Requested On:</span>
                  <div className="mt-1 font-medium">
                    {formatDateTime(detailsDialog.request.requestedAt)}
                  </div>
                </div>
              </div>

              {/* Card Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">
                  Card Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Card Number:</span>
                      <span className="font-mono font-medium">
                        {formatDisplayCardNumber(detailsDialog.request.displayCardNumber)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expiry Date:</span>
                      <span className="font-medium">
                        {formatDate(detailsDialog.request.expiryDate)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Current Status:</span>
                      <Badge variant={getStatusBadgeVariant(detailsDialog.request.cardStatus)}>
                        {getStatusLabel(detailsDialog.request.cardStatus)}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Updated:</span>
                      <span className="text-xs">
                        {formatDateTime(detailsDialog.request.lastUpdateTime)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Credit & Cash Limits */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">
                  Limits & Usage
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  {/* Credit Limit */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Credit Limit:</span>
                      <span className="font-medium">
                        {formatCurrency(detailsDialog.request.creditLimit)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Used: {formatCurrency(detailsDialog.request.usedCreditLimit)}</span>
                      <span>Available: {formatCurrency(detailsDialog.request.availableCreditLimit)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            ((detailsDialog.request.usedCreditLimit || 0) / (detailsDialog.request.creditLimit || 1)) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Cash Limit */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Cash Limit:</span>
                      <span className="font-medium">
                        {formatCurrency(detailsDialog.request.cashLimit)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Used: {formatCurrency(detailsDialog.request.usedCashLimit)}</span>
                      <span>Available: {formatCurrency(detailsDialog.request.availableCashLimit)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            ((detailsDialog.request.usedCashLimit || 0) / (detailsDialog.request.cashLimit || 1)) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Reason */}
              {detailsDialog.request.reason && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Reason</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                    {detailsDialog.request.reason}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setDetailsDialog({ isOpen: false, request: null })}
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const req = detailsDialog.request;
                    setDetailsDialog({ isOpen: false, request: null });
                    if (req) handleAction(req, 'reject');
                  }}
                  className="text-red-600 hover:bg-red-50 border-red-300"
                >
                  Reject Request
                </Button>
                <Button
                  onClick={() => {
                    const req = detailsDialog.request;
                    setDetailsDialog({ isOpen: false, request: null });
                    if (req) handleAction(req, 'approve');
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Approve Request
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => {
        if (!open) {
          setConfirmDialog({ isOpen: false, request: null, action: null });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.action === 'approve' ? 'Approve Request' : 'Reject Request'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.request && confirmDialog.action && (
                <div className="space-y-2 mt-2">
                  <p>
                    Are you sure you want to {confirmDialog.action === 'approve' ? 'approve' : 'reject'} this{' '}
                    {confirmDialog.request.requestTypeDescription?.toLowerCase()} request?
                  </p>
                  <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
                    <div>
                      <span className="font-medium">Card:</span>{' '}
                      {formatDisplayCardNumber(confirmDialog.request.displayCardNumber)}
                    </div>
                    <div>
                      <span className="font-medium">Action:</span>{' '}
                      {getActionText(confirmDialog.request.requestType, confirmDialog.action)}
                    </div>
                  </div>
                  {confirmDialog.action === 'approve' && confirmDialog.request.requestType === 'ACTI' && (
                    <p className="text-xs text-blue-600 mt-2">
                      ℹ️ The card will be activated and status will change to Active
                    </p>
                  )}
                  {confirmDialog.action === 'approve' && confirmDialog.request.requestType === 'CDCL' && (
                    <p className="text-xs text-orange-600 mt-2">
                      ⚠️ The card will be deactivated and status will change to Deactivated
                    </p>
                  )}
                  {confirmDialog.action === 'reject' && (
                    <p className="text-xs text-gray-600 mt-2">
                      ℹ️ The card status will be set to Deactivated and the request will be marked as rejected
                    </p>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ isOpen: false, request: null, action: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAction}
              variant={confirmDialog.action === 'reject' ? 'destructive' : 'default'}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestConfirmation;
