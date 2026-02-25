import { useState, useEffect } from 'react';
import { CreditCard, Calendar, CheckCircle2, AlertCircle, RefreshCw, Lock, Edit2, Search, User, FileDown, FileText, Filter, X, Eye } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../components/ui/dialog';
import { Pagination } from '../components/ui/pagination';
import { cardService, type CardDTO } from '../services/cardService';
import { reportService } from '../services/reportService';
import { getAllUsers } from '../services/userService';
import type { CreateCardRequest, UpdateCardRequest, PageResponse } from '../types/card';
import type { UserDTO } from '../types/user';
import { encryptPayload } from '../utils/encryptionUtil';
import { fetchPublicKey, encryptAESKey } from '../utils/rsaEncryptionUtil';
import { handleApiError } from '../utils/errorHandler';
import { downloadBlob, generateFileName, validateBlob } from '../utils/fileDownloadUtil';
import { formatCurrency } from '../utils/currencyFormatter';

export default function AddCard() {
  const [formData, setFormData] = useState<CreateCardRequest>({
    cardNumber: '',
    expiryDate: '',
    cardStatus: 'IACT', // Automatically set to Inactive
    creditLimit: 0,
    cashLimit: 0,
    availableCreditLimit: 0,
    availableCashLimit: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<{
    expiryDate?: string;
    creditLimit?: string;
    cashLimit?: string;
  }>({});

  const [cards, setCards] = useState<CardDTO[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [paginationInfo, setPaginationInfo] = useState<PageResponse<CardDTO> | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IACT' | 'CACT' | 'DACT'>('ALL');

  // Export state
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  
  // Report filter state
  const [showReportFilters, setShowReportFilters] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    expiryDateFrom: '',
    expiryDateTo: '',
    creditLimitMin: '',
    creditLimitMax: '',
    cashLimitMin: '',
    cashLimitMax: '',
  });

  // Edit card state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardDTO | null>(null);
  const [editFormData, setEditFormData] = useState({
    expiryDate: '',
    creditLimit: 0,
    cashLimit: 0,
    availableCreditLimit: 0,
    availableCashLimit: 0,
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // View plain card number state
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [plainCardNumber, setPlainCardNumber] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // User selection state
  const [allUsers, setAllUsers] = useState<UserDTO[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedUpdateUser, setSelectedUpdateUser] = useState<string>('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Helper function to get last day of month from YYYY-MM format
  const getLastDayOfMonth = (yearMonth: string): string => {
    const [year, month] = yearMonth.split('-').map(Number);
    // Create date for the first day of next month, then subtract 1 day
    const lastDay = new Date(year, month, 0).getDate();
    return `${yearMonth}-${lastDay.toString().padStart(2, '0')}`;
  };

  // Fetch all users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      setUsersError(null);
      try {
        const users = await getAllUsers();
        setAllUsers(users);
        // Auto-select first active user if available
        const firstActiveUser = users.find(u => u.status === 'ACT');
        if (firstActiveUser) {
          setSelectedUser(firstActiveUser.userName);
          setSelectedUpdateUser(firstActiveUser.userName);
        }
      } catch (error) {
        const errorMessage = handleApiError(error, 'Fetch Users');
        setUsersError(errorMessage);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Fetch all cards with pagination and filters
  const fetchCards = async () => {
    setIsLoadingCards(true);
    setCardsError(null);
    try {
      const response = await cardService.getAllCardsPaginated(currentPage, pageSize, statusFilter, searchQuery);
      setPaginationInfo(response.data);
      setCards(response.data.content || []);
    } catch (error) {
      const errorMessage = handleApiError(error, 'Fetch Cards');
      setCardsError(errorMessage);
    } finally {
      setIsLoadingCards(false);
    }
  };

  // Fetch cards when filters change - reset to page 0
  useEffect(() => {
    setCurrentPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchQuery]);

  // Fetch cards when page or page size changes
  useEffect(() => {
    fetchCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  // Validation functions
  const validateExpiryDate = (expiryDate: string): string | null => {
    if (!expiryDate) return null;

    const selectedDate = new Date(expiryDate + '-01');
    const today = new Date();
    
    // Set to first day of current month for comparison
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    if (selectedDate < currentMonth) {
      return 'Expiry date must be in the future';
    }

    return null;
  };

  const validateCreditLimit = (creditLimit: number): string | null => {
    if (creditLimit < 0) {
      return 'Credit limit must be positive';
    }
    if (creditLimit === 0) {
      return 'Credit limit must be greater than zero';
    }
    return null;
  };

  const validateCashLimit = (cashLimit: number, creditLimit: number): string | null => {
    if (cashLimit < 0) {
      return 'Cash limit must be positive';
    }
    if (cashLimit > creditLimit) {
      return 'Cash limit cannot exceed credit limit';
    }
    return null;
  };

  const validateForm = (): boolean => {
    const errors: {
      expiryDate?: string;
      creditLimit?: string;
      cashLimit?: string;
    } = {};

    // Validate expiry date
    const expiryError = validateExpiryDate(formData.expiryDate);
    if (expiryError) {
      errors.expiryDate = expiryError;
    }

    // Validate credit limit
    const creditLimitError = validateCreditLimit(formData.creditLimit);
    if (creditLimitError) {
      errors.creditLimit = creditLimitError;
    }

    // Validate cash limit
    const cashLimitError = validateCashLimit(formData.cashLimit, formData.creditLimit);
    if (cashLimitError) {
      errors.cashLimit = cashLimitError;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Format card number for display: first 6 + XXXXXX + last 4
  const formatDisplayCardNumber = (displayCardNumber: string) => {
    if (!displayCardNumber || displayCardNumber.length < 10) {
      return displayCardNumber;
    }
    
    // Extract first 6 digits
    const first6 = displayCardNumber.substring(0, 6);
    // Extract last 4 digits
    const last4 = displayCardNumber.substring(displayCardNumber.length - 4);
    
    // Format with spaces: XXXX XXXX XXXX XXXX
    const masked = `${first6.substring(0, 4)} ${first6.substring(4, 6)}XX XXXX ${last4}`;
    
    return masked;
  };

  const handleInputChange = (field: keyof CreateCardRequest, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear validation error for this field
    setValidationErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));

    // Validate expiry date immediately
    if (field === 'expiryDate' && typeof value === 'string') {
      const error = validateExpiryDate(value);
      if (error) {
        setValidationErrors((prev) => ({
          ...prev,
          expiryDate: error,
        }));
      }
    }

    // Auto-populate available limits when limits are set
    if (field === 'creditLimit') {
      const creditLimit = Number(value);
      setFormData((prev) => ({
        ...prev,
        creditLimit: creditLimit,
        availableCreditLimit: creditLimit,
      }));

      // Validate credit limit
      const creditError = validateCreditLimit(creditLimit);
      if (creditError) {
        setValidationErrors((prev) => ({
          ...prev,
          creditLimit: creditError,
        }));
      }

      // Re-validate cash limit when credit limit changes
      const cashError = validateCashLimit(formData.cashLimit, creditLimit);
      if (cashError) {
        setValidationErrors((prev) => ({
          ...prev,
          cashLimit: cashError,
        }));
      } else {
        setValidationErrors((prev) => ({
          ...prev,
          cashLimit: undefined,
        }));
      }
    }

    if (field === 'cashLimit') {
      const cashLimit = Number(value);
      setFormData((prev) => ({
        ...prev,
        cashLimit: cashLimit,
        availableCashLimit: cashLimit,
      }));

      // Validate cash limit
      const cashError = validateCashLimit(cashLimit, formData.creditLimit);
      if (cashError) {
        setValidationErrors((prev) => ({
          ...prev,
          cashLimit: cashError,
        }));
      }
    }
  };

  const formatCardNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    // Add space every 4 digits
    const formatted = digits.match(/.{1,4}/g)?.join(' ') || '';
    return formatted;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.replace(/\s/g, '').length <= 16) {
      setFormData((prev) => ({
        ...prev,
        cardNumber: formatted.replace(/\s/g, ''),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form before submitting
    if (!validateForm()) {
      setSubmitStatus({
        type: 'error',
        message: 'Please fix the validation errors before submitting.',
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      // Validate user is selected
      if (!selectedUser) {
        setSubmitStatus({
          type: 'error',
          message: 'Please select a user before submitting.',
        });
        return;
      }

      // Convert expiryDate from "YYYY-MM" to "YYYY-MM-01" (first day of the month)
      const expiryDateFormatted = formData.expiryDate ? `${formData.expiryDate}-01` : '';
      
      // Prepare data matching backend CreateCardRequest DTO
      const backendPayload = {
        cardNumber: formData.cardNumber,
        expiryDate: expiryDateFormatted,
        creditLimit: formData.creditLimit,
        cashLimit: formData.cashLimit,
        lastUpdatedUser: selectedUser,
      };
      
      // ============================================
      // SECURE HYBRID ENCRYPTION (RSA + AES)
      // ============================================
      
      // Step 1: Fetch RSA public key from backend
      const { sessionId, publicKey } = await fetchPublicKey('http://localhost:8090/api');
      
      // Step 2: Encrypt payload with AES-GCM (generates random AES key)
      const { encryptedData, encryptionKey } = await encryptPayload(backendPayload);
      
      // Step 3: Encrypt the AES key with RSA public key
      const encryptedKey = await encryptAESKey(encryptionKey, publicKey);
      
      // Step 4: Send encrypted data + encrypted key to backend
      const response = await cardService.createCardSecure(sessionId, encryptedData, encryptedKey);
      
      setSubmitStatus({
        type: 'success',
        message: response.message || 'Card created successfully with secure encryption!',
      });
      
      // Refresh cards list
      fetchCards();
      
      // Reset form after successful submission
      setTimeout(() => {
        setFormData({
          cardNumber: '',
          expiryDate: '',
          cardStatus: 'IACT', // Automatically set to Inactive
          creditLimit: 0,
          cashLimit: 0,
          availableCreditLimit: 0,
          availableCashLimit: 0,
        });
        setSubmitStatus({ type: null, message: '' });
      }, 3000);
    } catch (error) {
      const errorMessage = handleApiError(error, 'Card Creation');
      
      setSubmitStatus({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open edit dialog with card data
  const handleEditClick = (card: CardDTO) => {
    try {
      setEditingCard(card);
      // Convert expiryDate from "YYYY-MM-DD" to "YYYY-MM" for month input
      // Handle both string and potential date object formats
      const expiryDateStr = typeof card.expiryDate === 'string' 
        ? card.expiryDate 
        : String(card.expiryDate || '');
      const expiryMonth = expiryDateStr.substring(0, 7);
      setEditFormData({
        expiryDate: expiryMonth,
        creditLimit: card.creditLimit,
        cashLimit: card.cashLimit,
        availableCreditLimit: card.availableCreditLimit,
        availableCashLimit: card.availableCashLimit,
      });
      setIsEditDialogOpen(true);
    } catch (error) {
      console.error('Error opening edit dialog:', error);
      setSubmitStatus({
        type: 'error',
        message: 'Failed to open edit dialog. Please try again.',
      });
    }
  };

  // Handle edit form field changes
  const handleEditInputChange = (field: string, value: string | number) => {
    setEditFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Submit update
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;

    setIsUpdating(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      // Validate user is selected
      if (!selectedUpdateUser) {
        setSubmitStatus({
          type: 'error',
          message: 'Please select a user before submitting.',
        });
        return;
      }

      const expiryDateFormatted = editFormData.expiryDate ? `${editFormData.expiryDate}-01` : '';
      
      const updatePayload: UpdateCardRequest = {
        displayCardNumber: editingCard.displayCardNumber,
        encryptionKey: editingCard.encryptionKey,
        expiryDate: expiryDateFormatted,
        creditLimit: editFormData.creditLimit,
        cashLimit: editFormData.cashLimit,
        availableCreditLimit: editFormData.availableCreditLimit,
        availableCashLimit: editFormData.availableCashLimit,
        lastUpdatedUser: selectedUpdateUser,
      };

      const response = await cardService.updateCard(updatePayload);
      setSubmitStatus({
        type: 'success',
        message: response.message || 'Card updated successfully!',
      });

      // Close dialog and refresh cards
      setIsEditDialogOpen(false);
      setEditingCard(null);
      fetchCards();

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSubmitStatus({ type: null, message: '' });
      }, 3000);
    } catch (error) {
      const errorMessage = handleApiError(error, 'Card Update');
      
      setSubmitStatus({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle eye icon click to view plain card number
  const handleViewCardNumberClick = (cardId: string) => {
    setSelectedCardId(cardId);
    setAdminPassword('');
    setPlainCardNumber(null);
    setPasswordError(null);
    setIsPasswordDialogOpen(true);
  };

  // Handle admin password verification and fetch plain card number
  const handleVerifyPassword = async () => {
    if (!selectedCardId) return;
    if (!adminPassword.trim()) {
      setPasswordError('Please enter admin password');
      return;
    }

    setIsVerifyingPassword(true);
    setPasswordError(null);

    try {
      const response = await cardService.viewPlainCardNumber(selectedCardId, adminPassword);
      setPlainCardNumber(response.data.plainCardNumber);
      setPasswordError(null);
    } catch (error) {
      const errorMessage = handleApiError(error, 'Password Verification');
      setPasswordError(errorMessage);
      setPlainCardNumber(null);
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  // Handle closing the password dialog
  const handleClosePasswordDialog = () => {
    setIsPasswordDialogOpen(false);
    setSelectedCardId(null);
    setAdminPassword('');
    setPlainCardNumber(null);
    setPasswordError(null);
  };

  // Handle PDF Export
  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      setExportError(null);
      setExportSuccess(null);

      // Convert month format (YYYY-MM) to date format (YYYY-MM-DD) for backend
      const expiryDateFrom = reportFilters.expiryDateFrom 
        ? `${reportFilters.expiryDateFrom}-01` 
        : undefined;
      
      // For "to" date, use the last day of the month
      const expiryDateTo = reportFilters.expiryDateTo 
        ? getLastDayOfMonth(reportFilters.expiryDateTo) 
        : undefined;

      // Pass current filters to the export function
      const blob = await reportService.downloadCardReportPDF({
        status: statusFilter,
        search: searchQuery,
        expiryDateFrom,
        expiryDateTo,
        creditLimitMin: reportFilters.creditLimitMin ? Number(reportFilters.creditLimitMin) : undefined,
        creditLimitMax: reportFilters.creditLimitMax ? Number(reportFilters.creditLimitMax) : undefined,
        cashLimitMin: reportFilters.cashLimitMin ? Number(reportFilters.cashLimitMin) : undefined,
        cashLimitMax: reportFilters.cashLimitMax ? Number(reportFilters.cashLimitMax) : undefined,
      });
      
      if (!validateBlob(blob, 'pdf')) {
        throw new Error('Invalid PDF file received from server');
      }
      
      const fileName = generateFileName('card-report', 'pdf');
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

      // Convert month format (YYYY-MM) to date format (YYYY-MM-DD) for backend
      const expiryDateFrom = reportFilters.expiryDateFrom 
        ? `${reportFilters.expiryDateFrom}-01` 
        : undefined;
      
      // For "to" date, use the last day of the month
      const expiryDateTo = reportFilters.expiryDateTo 
        ? getLastDayOfMonth(reportFilters.expiryDateTo) 
        : undefined;

      // Pass current filters to the export function
      const blob = await reportService.downloadCardReportCSV({
        status: statusFilter,
        search: searchQuery,
        expiryDateFrom,
        expiryDateTo,
        creditLimitMin: reportFilters.creditLimitMin ? Number(reportFilters.creditLimitMin) : undefined,
        creditLimitMax: reportFilters.creditLimitMax ? Number(reportFilters.creditLimitMax) : undefined,
        cashLimitMin: reportFilters.cashLimitMin ? Number(reportFilters.cashLimitMin) : undefined,
        cashLimitMax: reportFilters.cashLimitMax ? Number(reportFilters.cashLimitMax) : undefined,
      });
      
      if (!validateBlob(blob, 'csv')) {
        throw new Error('Invalid CSV file received from server');
      }
      
      const fileName = generateFileName('card-report', 'csv');
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

  return (
    <div>
      {/* Status Message - Top Right Banner */}
      {submitStatus.type && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl flex items-center gap-3 shadow-lg min-w-[320px] animate-slide-in-right ${
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

        {/* Form Card */}
        <Card className="shadow-sm border border-gray-200 bg-white rounded-xl overflow-hidden">
          <CardHeader className="pb-4 bg-blue-900 text-white">
            <CardTitle className="text-xl text-white flex items-center gap-2">
              Add a New Card
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Card Visualization */}
              <div className="flex items-center justify-center">
                <div className="w-full max-w-md">
                  <div className="relative aspect-[1.586/1] w-full bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 rounded-2xl shadow-2xl p-6 text-white">
                    {/* Card Background Pattern */}
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -mr-20 -mt-20"></div>
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full -ml-16 -mb-16"></div>
                    </div>
                    
                    {/* Card Content */}
                    <div className="relative h-full flex flex-col justify-between">
                      {/* Chip and Logo */}
                      <div className="flex justify-between items-start">
                        <div className="w-12 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-md"></div>
                        <div className="text-right">
                          <div className="text-xs font-semibold tracking-wider opacity-80">EPIC LANKA</div>
                        </div>
                      </div>
                      
                      {/* Card Number */}
                      <div className="space-y-1">
                        <div className="text-xs text-gray-300 uppercase tracking-wider">Card Number</div>
                        <div className="text-2xl font-mono tracking-wider">
                          {formData.cardNumber 
                            ? formatCardNumber(formData.cardNumber) 
                            : '•••• •••• •••• ••••'}
                        </div>
                      </div>
                      
                      {/* Card Holder and Expiry */}
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <div className="text-xs text-gray-300 uppercase tracking-wider">Card Holder</div>
                          <div className="text-sm font-semibold tracking-wide">CARD HOLDER</div>
                        </div>
                        <div className="space-y-1 text-right">
                          <div className="text-xs text-gray-300 uppercase tracking-wider">Expires</div>
                          <div className="text-sm font-semibold font-mono">
                            {formData.expiryDate 
                              ? new Date(formData.expiryDate + '-01').toLocaleDateString('en-US', { month: '2-digit', year: '2-digit' })
                              : '••/••'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div>
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* User Selection Dropdown - At Top */}
                  <div className="space-y-1.5 pb-4 border-b border-gray-200">
                    <Label htmlFor="selectedUser" className="text-sm font-medium flex items-center gap-1.5 text-gray-700">
                      <User className="h-3.5 w-3.5 text-blue-900" />
                      Created By <span className="text-red-500">*</span>
                    </Label>
                    {isLoadingUsers ? (
                      <div className="text-sm text-gray-500">Loading users...</div>
                    ) : usersError ? (
                      <div className="text-sm text-red-600">{usersError}</div>
                    ) : (
                      <select
                        id="selectedUser"
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        required
                        className="w-full h-10 border border-gray-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a user</option>
                        {allUsers.map((user) => (
                          <option
                            key={user.userName}
                            value={user.userName}
                            disabled={user.status !== 'ACT'}
                            className={user.status === 'ACT' ? 'text-gray-900' : 'text-gray-400 bg-gray-100'}
                          >
                            {user.name} ({user.userName}) {user.status !== 'ACT' ? '- Inactive' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Card Number and Expiry Date Row */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="cardNumber" className="text-sm font-medium flex items-center gap-1.5 text-gray-700">
                        <CreditCard className="h-3.5 w-3.5 text-blue-900" />
                        Card Number
                      </Label>
                      <Input
                        id="cardNumber"
                        placeholder="1234 5678 9012 3456"
                        value={formatCardNumber(formData.cardNumber)}
                        onChange={handleCardNumberChange}
                        required
                        className="h-10 font-mono border-gray-300 rounded-lg"
                        maxLength={19}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="expiryDate" className="text-sm font-medium flex items-center gap-1.5 text-gray-700">
                        <Calendar className="h-3.5 w-3.5 text-blue-900" />
                        Expiry Date
                      </Label>
                      <Input
                        id="expiryDate"
                        type="month"
                        value={formData.expiryDate}
                        onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                        required
                        className={`h-10 border-gray-300 rounded-lg ${
                          validationErrors.expiryDate ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                        }`}
                      />
                      {validationErrors.expiryDate && (
                        <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {validationErrors.expiryDate}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Credit Limits */}
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5 text-gray-900 mb-3">
                      Credit Limits
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="creditLimit" className="text-xs font-medium text-gray-700">
                          Credit Limit
                        </Label>
                        <Input
                          id="creditLimit"
                          type="number"
                          placeholder="0.00"
                          value={formData.creditLimit || ''}
                          onChange={(e) => handleInputChange('creditLimit', parseFloat(e.target.value) || 0)}
                          required
                          min="0"
                          step="0.01"
                          className={`h-9 bg-white border-gray-300 rounded-lg ${
                            validationErrors.creditLimit ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                          }`}
                        />
                        {validationErrors.creditLimit && (
                          <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                            <AlertCircle className="h-3 w-3" />
                            {validationErrors.creditLimit}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="availableCreditLimit" className="text-xs font-medium text-gray-700">
                          Available Credit
                        </Label>
                        <Input
                          id="availableCreditLimit"
                          type="number"
                          placeholder="0.00"
                          value={formData.availableCreditLimit || ''}
                          onChange={(e) =>
                            handleInputChange('availableCreditLimit', parseFloat(e.target.value) || 0)
                          }
                          required
                          min="0"
                          step="0.01"
                          className="h-9 bg-white border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cash Limits */}
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5 text-gray-900 mb-3">
                      Cash Limits
                    </h3>
                    <p className="text-xs text-gray-600 mb-3">
                      Cash limit must be equal to or less than credit limit
                    </p>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="cashLimit" className="text-xs font-medium text-gray-700">
                          Cash Limit
                        </Label>
                        <Input
                          id="cashLimit"
                          type="number"
                          placeholder="0.00"
                          value={formData.cashLimit || ''}
                          onChange={(e) => handleInputChange('cashLimit', parseFloat(e.target.value) || 0)}
                          required
                          min="0"
                          step="0.01"
                          className={`h-9 bg-white border-gray-300 rounded-lg ${
                            validationErrors.cashLimit ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                          }`}
                        />
                        {validationErrors.cashLimit && (
                          <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                            <AlertCircle className="h-3 w-3" />
                            {validationErrors.cashLimit}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="availableCashLimit" className="text-xs font-medium text-gray-700">
                          Available Cash
                        </Label>
                        <Input
                          id="availableCashLimit"
                          type="number"
                          placeholder="0.00"
                          value={formData.availableCashLimit || ''}
                          onChange={(e) =>
                            handleInputChange('availableCashLimit', parseFloat(e.target.value) || 0)
                          }
                          required
                          min="0"
                          step="0.01"
                          className="h-9 bg-white border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-11 text-base font-semibold bg-blue-900 hover:bg-blue-950 rounded-lg"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Creating Card...
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Create Card
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>All fields are required. Ensure the card number is valid before submission.</p>
        </div>

        {/* Cards List Section */}
        <Card className="mt-12 shadow-sm border border-gray-200 bg-white rounded-xl overflow-hidden">
          <CardHeader className="bg-blue-900 text-white">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl text-white">All Cards</CardTitle>
                <CardDescription className="text-blue-100">
                  View all cards in the system
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

          {/* Export Success/Error Messages */}
          {(exportSuccess || exportError) && (
            <div className={`mx-4 mt-4 p-3 rounded-lg border ${
              exportSuccess 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {exportSuccess ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <p className="text-sm font-medium">{exportSuccess || exportError}</p>
              </div>
            </div>
          )}

          {/* Export Buttons Section */}
          <div className="bg-white border-b border-gray-200 px-4 pt-4 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileDown className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Export Reports:</span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowReportFilters(!showReportFilters)}
                  variant="outline"
                  size="sm"
                  className={`border-gray-300 ${showReportFilters ? 'bg-gray-100' : ''}`}
                >
                  <Filter className="h-3.5 w-3.5 mr-1.5" />
                  {showReportFilters ? 'Hide Filters' : 'Show Filters'}
                </Button>
                <Button
                  onClick={handleExportPDF}
                  disabled={isExportingPDF || isExportingCSV || isLoadingCards}
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {isExportingPDF ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      Export as PDF
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleExportCSV}
                  disabled={isExportingPDF || isExportingCSV || isLoadingCards}
                  variant="outline"
                  size="sm"
                  className="border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50"
                >
                  {isExportingCSV ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      Export as CSV
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Report Filters Panel */}
            {showReportFilters && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Report Filters</h3>
                  <Button
                    onClick={() => setReportFilters({
                      expiryDateFrom: '',
                      expiryDateTo: '',
                      creditLimitMin: '',
                      creditLimitMax: '',
                      cashLimitMin: '',
                      cashLimitMax: '',
                    })}
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear All
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Expiry Date Range */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700">Expiry Month From</Label>
                    <Input
                      type="month"
                      value={reportFilters.expiryDateFrom}
                      onChange={(e) => setReportFilters({ ...reportFilters, expiryDateFrom: e.target.value })}
                      className="text-sm"
                      placeholder="YYYY-MM"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700">Expiry Month To</Label>
                    <Input
                      type="month"
                      value={reportFilters.expiryDateTo}
                      onChange={(e) => setReportFilters({ ...reportFilters, expiryDateTo: e.target.value })}
                      className="text-sm"
                      placeholder="YYYY-MM"
                    />
                  </div>

                  {/* Credit Limit Range */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700">Min Credit Limit</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 10000"
                      value={reportFilters.creditLimitMin}
                      onChange={(e) => setReportFilters({ ...reportFilters, creditLimitMin: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700">Max Credit Limit</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 100000"
                      value={reportFilters.creditLimitMax}
                      onChange={(e) => setReportFilters({ ...reportFilters, creditLimitMax: e.target.value })}
                      className="text-sm"
                    />
                  </div>

                  {/* Cash Limit Range */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700">Min Cash Limit</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 5000"
                      value={reportFilters.cashLimitMin}
                      onChange={(e) => setReportFilters({ ...reportFilters, cashLimitMin: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700">Max Cash Limit</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 50000"
                      value={reportFilters.cashLimitMax}
                      onChange={(e) => setReportFilters({ ...reportFilters, cashLimitMax: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Note: Expiry date filters use month/year format (e.g., 2026-12). All filters are applied along with status and search when exporting reports.
                </p>
              </div>
            )}
          </div>

          {/* Search and Filter Section */}
          <div className="bg-gray-50 border-b border-gray-200 p-4 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by card number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-white border-gray-300 rounded-lg"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
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
                Inactive ({cards.filter(c => c.cardStatus === 'IACT').length})
              </Button>
              <Button
                onClick={() => setStatusFilter('CACT')}
                variant={statusFilter === 'CACT' ? 'default' : 'outline'}
                size="sm"
                className={statusFilter === 'CACT' ? 'bg-blue-900 hover:bg-blue-950' : 'hover:bg-gray-100'}
              >
                Active ({cards.filter(c => c.cardStatus === 'CACT').length})
              </Button>
              <Button
                onClick={() => setStatusFilter('DACT')}
                variant={statusFilter === 'DACT' ? 'default' : 'outline'}
                size="sm"
                className={statusFilter === 'DACT' ? 'bg-blue-900 hover:bg-blue-950' : 'hover:bg-gray-100'}
              >
                Deactivated ({cards.filter(c => c.cardStatus === 'DACT').length})
              </Button>
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
                <CreditCard className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">No cards found</p>
                <p className="text-sm">Create your first card using the form above</p>
              </div>
            ) : cards.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Search className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">No cards match your search</p>
                <p className="text-sm">Try adjusting your search or filter criteria</p>
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
                        <button
                          onClick={() => card.cardNumber && handleViewCardNumberClick(card.cardNumber)}
                          className="text-gray-400 hover:text-blue-900 transition-colors p-1 rounded hover:bg-blue-50"
                          title="View full card number"
                          disabled={!card.cardNumber}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Expiry Date */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Calendar className="h-3.5 w-3.5 text-gray-500" />
                        <span className="text-sm text-gray-700">
                          {new Date(card.expiryDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                          })}
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
                            ? 'Deactive'
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
                          {card.lastUpdateTime && !isNaN(new Date(card.lastUpdateTime).getTime())
                            ? new Date(card.lastUpdateTime).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'N/A'}
                        </div>
                      </div>

                      {/* Edit Button */}
                      <div className="flex-shrink-0">
                        <Button
                          onClick={() => handleEditClick(card)}
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 border-blue-900 text-blue-900 hover:bg-blue-50"
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
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
                setCurrentPage(0); // Reset to first page when changing page size
              }}
              totalElements={paginationInfo.totalElements}
              hasNext={paginationInfo.hasNext}
              hasPrevious={paginationInfo.hasPrevious}
            />
          )}
        </Card>

        {/* Edit Card Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px] p-0">
            <DialogClose onClose={() => setIsEditDialogOpen(false)} />
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle className="text-xl font-semibold text-gray-900">
                Edit Card Details
              </DialogTitle>
            </DialogHeader>
            
            {editingCard && (
              <form onSubmit={handleUpdateSubmit} className="px-6 pb-6 space-y-4">
                {/* User Selection Dropdown */}
                <div className="space-y-2">
                  <Label htmlFor="selectedUpdateUser" className="text-sm font-medium text-gray-700">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-blue-900" />
                      Updated By <span className="text-red-500">*</span>
                    </div>
                  </Label>
                  {isLoadingUsers ? (
                    <div className="text-sm text-gray-500">Loading users...</div>
                  ) : usersError ? (
                    <div className="text-sm text-red-600">{usersError}</div>
                  ) : (
                    <select
                      id="selectedUpdateUser"
                      value={selectedUpdateUser}
                      onChange={(e) => setSelectedUpdateUser(e.target.value)}
                      required
                      className="w-full h-10 border border-gray-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select a user</option>
                      {allUsers.map((user) => (
                        <option
                          key={user.userName}
                          value={user.userName}
                          disabled={user.status !== 'ACT'}
                          className={user.status === 'ACT' ? 'text-gray-900' : 'text-gray-400 bg-gray-100'}
                        >
                          {user.name} ({user.userName}) {user.status !== 'ACT' ? '- Inactive' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Card Number (Read-only) */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Card Number
                  </Label>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <Lock className="h-4 w-4 text-gray-400" />
                    <span className="font-mono font-semibold text-gray-600">
                      {formatDisplayCardNumber(editingCard.displayCardNumber)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Card number cannot be modified</p>
                </div>

                {/* Expiry Date */}
                <div className="space-y-2">
                  <Label htmlFor="edit-expiryDate" className="text-sm font-medium text-gray-700">
                    Expiry Date *
                  </Label>
                  <Input
                    id="edit-expiryDate"
                    type="month"
                    value={editFormData.expiryDate}
                    onChange={(e) => handleEditInputChange('expiryDate', e.target.value)}
                    required
                    className="h-10 bg-white border-gray-300 rounded-lg"
                  />
                </div>

                {/* Limits Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Credit Limit */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-creditLimit" className="text-sm font-medium text-gray-700">
                      Credit Limit *
                    </Label>
                    <Input
                      id="edit-creditLimit"
                      type="number"
                      placeholder="0.00"
                      value={editFormData.creditLimit || ''}
                      onChange={(e) =>
                        handleEditInputChange('creditLimit', parseFloat(e.target.value) || 0)
                      }
                      required
                      min="0"
                      step="0.01"
                      className="h-10 bg-white border-gray-300 rounded-lg"
                    />
                  </div>

                  {/* Cash Limit */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-cashLimit" className="text-sm font-medium text-gray-700">
                      Cash Limit *
                    </Label>
                    <Input
                      id="edit-cashLimit"
                      type="number"
                      placeholder="0.00"
                      value={editFormData.cashLimit || ''}
                      onChange={(e) =>
                        handleEditInputChange('cashLimit', parseFloat(e.target.value) || 0)
                      }
                      required
                      min="0"
                      step="0.01"
                      className="h-10 bg-white border-gray-300 rounded-lg"
                    />
                  </div>

                  {/* Available Credit Limit */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-availableCreditLimit" className="text-sm font-medium text-gray-700">
                      Available Credit *
                    </Label>
                    <Input
                      id="edit-availableCreditLimit"
                      type="number"
                      placeholder="0.00"
                      value={editFormData.availableCreditLimit || ''}
                      onChange={(e) =>
                        handleEditInputChange('availableCreditLimit', parseFloat(e.target.value) || 0)
                      }
                      required
                      min="0"
                      step="0.01"
                      className="h-10 bg-white border-gray-300 rounded-lg"
                    />
                  </div>

                  {/* Available Cash Limit */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-availableCashLimit" className="text-sm font-medium text-gray-700">
                      Available Cash *
                    </Label>
                    <Input
                      id="edit-availableCashLimit"
                      type="number"
                      placeholder="0.00"
                      value={editFormData.availableCashLimit || ''}
                      onChange={(e) =>
                        handleEditInputChange('availableCashLimit', parseFloat(e.target.value) || 0)
                      }
                      required
                      min="0"
                      step="0.01"
                      className="h-10 bg-white border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                    disabled={isUpdating}
                    className="flex-1 h-10 border-gray-300 hover:bg-gray-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isUpdating}
                    className="flex-1 h-10 bg-blue-900 hover:bg-blue-950"
                  >
                    {isUpdating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Updating...
                      </>
                    ) : (
                      'Update Card'
                    )}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* View Plain Card Number Dialog */}
        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
          <DialogContent className="sm:max-w-[400px] p-0">
            <DialogClose onClose={handleClosePasswordDialog} />
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle className="text-xl font-semibold text-gray-900">
                View Full Card Number
              </DialogTitle>
            </DialogHeader>
            
            <div className="px-6 pb-6 space-y-4">
              {!plainCardNumber ? (
                <>
                  {/* Password Input */}
                  <div className="space-y-2">
                    <Label htmlFor="adminPassword" className="text-sm font-medium text-gray-700">
                      Admin Password <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      placeholder="Enter admin password"
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPassword(e.target.value);
                        setPasswordError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isVerifyingPassword) {
                          handleVerifyPassword();
                        }
                      }}
                      disabled={isVerifyingPassword}
                      className="h-10 bg-white border-gray-300 rounded-lg"
                      autoFocus
                    />
                    {passwordError && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {passwordError}
                      </p>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClosePasswordDialog}
                      disabled={isVerifyingPassword}
                      className="flex-1 h-10 border-gray-300 hover:bg-gray-50"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleVerifyPassword}
                      disabled={isVerifyingPassword || !adminPassword}
                      className="flex-1 h-10 bg-blue-900 hover:bg-blue-950"
                    >
                      {isVerifyingPassword ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Verifying...
                        </>
                      ) : (
                        'View Card Number'
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Plain Card Number Display */}
                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-xs text-green-700 font-medium mb-2">FULL CARD NUMBER</div>
                      <div className="font-mono font-bold text-green-900 text-lg tracking-wider">
                        {plainCardNumber}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      This information is sensitive. Keep it secure.
                    </p>
                  </div>

                  {/* Close Button */}
                  <div className="pt-2">
                    <Button
                      type="button"
                      onClick={handleClosePasswordDialog}
                      className="w-full h-10 bg-blue-900 hover:bg-blue-950"
                    >
                      Close
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
}
