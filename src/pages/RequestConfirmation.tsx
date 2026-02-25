import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Pagination } from '../components/ui/pagination';
import { Search, FileDown, FileText, FileSpreadsheet } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { cardRequestService } from '../services/cardService';
import { reportService } from '../services/reportService';
import type { CardRequestDetailDTO, PageResponse } from '../types/card';
import { handleApiError, logError } from '../utils/errorHandler';
import { getActiveUsers } from '../services/userService';
import type { UserDTO } from '../types/user';
import { downloadBlob, generateFileName, validateBlob } from '../utils/fileDownloadUtil';
import { formatCurrency } from '../utils/currencyFormatter';

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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PEND' | 'APPR' | 'RJCT'>('PEND');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [paginationInfo, setPaginationInfo] = useState<PageResponse<CardRequestDetailDTO> | null>(null);
  
  // User selection state
  const [activeUsers, setActiveUsers] = useState<UserDTO[]>([]);
  const [selectedApprovedUser, setSelectedApprovedUser] = useState<string>('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    request: null,
    action: null,
  });
  const [detailsDialog, setDetailsDialog] = useState<DetailsDialogState>({
    isOpen: false,
    request: null,
  });

  // Export state
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Fetch requests with pagination and status filter
  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const response = await cardRequestService.getPendingRequestsWithDetailsPaginated(currentPage, pageSize, statusFilter);
      setPaginationInfo(response.data);
      setRequests(response.data.content || []);
    } catch (error) {
      handleApiError(error, 'Failed to load requests');
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch when page, page size, or status filter changes
  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, statusFilter]);

  // Fetch active users on mount
  useEffect(() => {
    const loadActiveUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const users = await getActiveUsers();
        setActiveUsers(users);
        // Auto-select first user if available
        if (users.length > 0) {
          setSelectedApprovedUser(users[0].userName);
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

      // Validate user is selected
      if (!selectedApprovedUser || selectedApprovedUser.trim().length === 0) {
        handleApiError(new Error('Please select a user to process the request'), 'Process Request');
        return;
      }

      if (action === 'approve') {
        await cardRequestService.approveRequest(request.requestId, selectedApprovedUser);
      } else {
        await cardRequestService.rejectRequest(request.requestId, selectedApprovedUser);
      }

      // Close dialog
      setConfirmDialog({ isOpen: false, request: null, action: null });

      // Refresh the list in background (don't await to avoid blocking UI)
      Promise.all([fetchRequests()]).catch((error) => {
        if (import.meta.env.DEV) {
          console.warn('Background refresh failed:', error);
        }
      });
    } catch (error) {
      handleApiError(error, `Failed to ${action} request`);
    }
  };

  // Handle PDF Export
  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      setExportError(null);
      setExportSuccess(null);

      // Pass current filters to the export function
      const blob = await reportService.downloadCardRequestReportPDF({
        status: statusFilter,
        requestType: requestTypeFilter,
        search: searchQuery,
      });
      
      if (!validateBlob(blob, 'pdf')) {
        throw new Error('Invalid PDF file received from server');
      }
      
      const fileName = generateFileName('card-request-report', 'pdf');
      downloadBlob(blob, fileName);
      
      setExportSuccess(`PDF report exported successfully as ${fileName}`);
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (error) {
      const errorMessage = handleApiError(error, 'PDF Export');
      setExportError(errorMessage);
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Handle CSV Export
  const handleExportCSV = async () => {
    try {
      setIsExportingCSV(true);
      setExportError(null);
      setExportSuccess(null);

      // Pass current filters to the export function
      const blob = await reportService.downloadCardRequestReportCSV({
        status: statusFilter,
        requestType: requestTypeFilter,
        search: searchQuery,
      });
      
      if (!validateBlob(blob, 'csv')) {
        throw new Error('Invalid CSV file received from server');
      }
      
      const fileName = generateFileName('card-request-report', 'csv');
      downloadBlob(blob, fileName);
      
      setExportSuccess(`CSV report exported successfully as ${fileName}`);
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (error) {
      const errorMessage = handleApiError(error, 'CSV Export');
      setExportError(errorMessage);
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setIsExportingCSV(false);
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
            <p className="mt-4 text-gray-600">Loading requests...</p>
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
                Review and process card activation/deactivation requests
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {/* Export Buttons Section */}
        <div className="bg-white border-b border-gray-200 px-4 pt-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileDown className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Export Reports:</span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleExportPDF}
                disabled={isExportingPDF || isExportingCSV || isLoading}
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                {isExportingPDF ? (
                  <>
                    <div className="h-3.5 w-3.5 mr-1.5 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    Export PDF
                  </>
                )}
              </Button>
              <Button
                onClick={handleExportCSV}
                disabled={isExportingPDF || isExportingCSV || isLoading}
                variant="outline"
                size="sm"
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                {isExportingCSV ? (
                  <>
                    <div className="h-3.5 w-3.5 mr-1.5 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                    Export CSV
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Export Success/Error Messages */}
          {exportSuccess && (
            <div className="mt-3 p-2.5 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">{exportSuccess}</p>
            </div>
          )}
          {exportError && (
            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{exportError}</p>
            </div>
          )}
        </div>

        {/* Filter Section */}
        {requests.length > 0 && (
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            {/* Status Filter */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-medium text-gray-700">Filter by Status:</span>
              <div className="flex gap-2">
                <Button
                  onClick={() => setStatusFilter('ALL')}
                  variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                  size="sm"
                  className={statusFilter === 'ALL' ? 'bg-blue-900 hover:bg-blue-950' : 'hover:bg-gray-100'}
                >
                  All Statuses
                </Button>
                <Button
                  onClick={() => setStatusFilter('PEND')}
                  variant={statusFilter === 'PEND' ? 'default' : 'outline'}
                  size="sm"
                  className={statusFilter === 'PEND' ? 'bg-yellow-600 hover:bg-yellow-700' : 'hover:bg-yellow-50 text-yellow-700 border-yellow-300'}
                >
                  Pending
                </Button>
                <Button
                  onClick={() => setStatusFilter('APPR')}
                  variant={statusFilter === 'APPR' ? 'default' : 'outline'}
                  size="sm"
                  className={statusFilter === 'APPR' ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-green-50 text-green-700 border-green-300'}
                >
                  Approved
                </Button>
                <Button
                  onClick={() => setStatusFilter('RJCT')}
                  variant={statusFilter === 'RJCT' ? 'default' : 'outline'}
                  size="sm"
                  className={statusFilter === 'RJCT' ? 'bg-red-600 hover:bg-red-700' : 'hover:bg-red-50 text-red-700 border-red-300'}
                >
                  Rejected
                </Button>
              </div>
            </div>
            
            {/* Request Type Filter */}
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
                <p className="text-lg font-medium">
                  {statusFilter === 'PEND' ? 'No pending requests' : 
                   statusFilter === 'APPR' ? 'No approved requests' :
                   statusFilter === 'RJCT' ? 'No rejected requests' : 'No requests'}
                </p>
                <p className="text-sm mt-1">
                  {statusFilter === 'PEND' ? 'All requests have been processed' :
                   statusFilter === 'APPR' ? 'No requests have been approved yet' :
                   statusFilter === 'RJCT' ? 'No requests have been rejected yet' : 'No requests found'}
                </p>
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
                  {/* Top Row: Main Info */}
                  <div className="grid grid-cols-12 gap-3 items-center mb-3">
                    {/* Request ID and Type - 2 cols */}
                    <div className="col-span-2">
                      <div className="text-xs text-gray-500 mb-1">Request #{request.requestId}</div>
                      <Badge 
                        variant={getRequestTypeBadgeVariant(request.requestType)}
                        className="text-xs"
                      >
                        {request.requestType === 'ACTI' ? 'Activation' : 'Deactivation'}
                      </Badge>
                    </div>

                    {/* Request Status - 2 cols */}
                    <div className="col-span-2">
                      <div className="text-xs text-gray-500 mb-1">Status</div>
                      <Badge 
                        variant={
                          request.requestStatus === 'PEND' ? 'outline' :
                          request.requestStatus === 'APPR' ? 'default' : 'destructive'
                        }
                        className={
                          request.requestStatus === 'PEND' ? 'bg-yellow-50 text-yellow-700 border-yellow-300' :
                          request.requestStatus === 'APPR' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                        }
                      >
                        {request.requestStatus === 'PEND' ? 'Pending' :
                         request.requestStatus === 'APPR' ? 'Approved' : 'Rejected'}
                      </Badge>
                    </div>

                    {/* Card Number - 3 cols */}
                    <div className="col-span-3">
                      <div className="text-xs text-gray-500 mb-1">Card Number</div>
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {formatDisplayCardNumber(request.displayCardNumber)}
                      </span>
                    </div>

                    {/* Card Status - 2 cols */}
                    <div className="col-span-2">
                      <div className="text-xs text-gray-500 mb-1">Card Status</div>
                      <Badge 
                        variant={getStatusBadgeVariant(request.cardStatus)} 
                        className="text-xs px-2 py-1"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          <span>{getStatusLabel(request.cardStatus)}</span>
                        </span>
                      </Badge>
                    </div>

                    {/* Request Date - 3 cols */}
                    <div className="col-span-3">
                      <div className="text-xs text-gray-500 mb-1">Requested Date</div>
                      <div className="text-sm text-gray-900">
                        {formatDate(request.requestedAt, true)}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Reason and Actions */}
                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
                    {/* Reason - flexible width */}
                    <div className="flex-1 min-w-0">
                      {request.reason ? (
                        <>
                          <div className="text-xs text-gray-500 mb-1">Reason</div>
                          <p className="text-sm text-gray-700 truncate" title={request.reason}>
                            {request.reason}
                          </p>
                        </>
                      ) : (
                        <div className="text-sm text-gray-400 italic">No reason provided</div>
                      )}
                    </div>

                    {/* Actions - fixed width */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDetailsDialog({ isOpen: true, request })}
                        className="min-w-[80px]"
                      >
                        Details
                      </Button>
                      {request.requestStatus === 'PEND' && (
                        <>
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
                        </>
                      )}
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
                  
                  {/* User Selection Dropdown */}
                  <div className="space-y-2 pt-3">
                    <Label htmlFor="approvedUser" className="text-sm font-semibold text-gray-700">
                      {confirmDialog.action === 'approve' ? 'Approved' : 'Rejected'} By <span className="text-red-500">*</span>
                    </Label>
                    <select
                      id="approvedUser"
                      value={selectedApprovedUser}
                      onChange={(e) => setSelectedApprovedUser(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                      disabled={isLoadingUsers}
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
              disabled={!selectedApprovedUser}
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
