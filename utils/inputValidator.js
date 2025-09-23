/**
 * Enterprise Input Validation & Sanitization Library for SichrPlace
 * Comprehensive protection against injection attacks and malicious input
 */

export class InputValidator {
  constructor() {
    // XSS Prevention patterns
    this.xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>.*?<\/embed>/gi,
      /<link[^>]*>/gi,
      /<meta[^>]*>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      /on\w+\s*=/gi, // Event handlers
      /expression\s*\(/gi,
      /url\s*\(/gi,
      /&lt;script/gi,
      /&lt;\/script&gt;/gi
    ];

    // SQL Injection patterns
    this.sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
      /(;|\||&|\$|`|'|"|\\)/g,
      /(\b(or|and)\b\s+\b(1=1|1=0|true|false)\b)/gi,
      /(\/\*|\*\/|--|\#)/g,
      /(\b(information_schema|sys\.|mysql\.|pg_|sqlite_)\b)/gi
    ];

    // Command injection patterns
    this.commandPatterns = [
      /[;&|`$()]/g,
      /\b(rm|del|format|cat|type|more|less|head|tail|grep|find|ls|dir)\b/gi,
      /\.\.\//g,
      /\\x[0-9a-f]{2}/gi,
      /%[0-9a-f]{2}/gi
    ];

    // Validation schemas
    this.schemas = {
      email: {
        pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        maxLength: 254,
        required: true
      },
      password: {
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
      },
      name: {
        pattern: /^[a-zA-ZäöüßÄÖÜ\s'-]+$/,
        minLength: 1,
        maxLength: 100,
        required: true
      },
      phone: {
        pattern: /^[\+]?[1-9][\d]{0,15}$/,
        maxLength: 20
      },
      url: {
        pattern: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
        maxLength: 2048
      },
      address: {
        maxLength: 200,
        pattern: /^[a-zA-Z0-9äöüßÄÖÜ\s.,-]+$/
      },
      postalCode: {
        pattern: /^\d{5}$/, // German postal codes
        required: true
      },
      price: {
        pattern: /^\d+(\.\d{1,2})?$/,
        min: 0,
        max: 999999.99
      },
      userId: {
        pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        required: true
      },
      fileName: {
        pattern: /^[a-zA-Z0-9._-]+$/,
        maxLength: 255,
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx']
      },
      searchQuery: {
        maxLength: 500,
        pattern: /^[a-zA-Z0-9äöüßÄÖÜ\s.,-]*$/
      }
    };
  }

  /**
   * Main validation function
   */
  validate(data, schema, context = {}) {
    const errors = [];
    const sanitized = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      const result = this.validateField(field, value, rules, context);
      
      if (result.errors.length > 0) {
        errors.push(...result.errors);
      } else {
        sanitized[field] = result.value;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized
    };
  }

  /**
   * Validates a single field
   */
  validateField(fieldName, value, rules, context = {}) {
    const errors = [];
    let sanitizedValue = value;

    // Check if required
    if (rules.required && (value === undefined || value === null || value === '')) {
      return {
        errors: [`${fieldName} is required`],
        value: null
      };
    }

    // Skip validation if value is empty and not required
    if (!rules.required && (value === undefined || value === null || value === '')) {
      return {
        errors: [],
        value: null
      };
    }

    // Convert to string for validation
    const strValue = String(value);

    // XSS Protection
    if (this.containsXSS(strValue)) {
      errors.push(`${fieldName} contains potentially malicious content`);
      return { errors, value: null };
    }

    // SQL Injection Protection
    if (this.containsSQLInjection(strValue)) {
      errors.push(`${fieldName} contains potentially malicious SQL content`);
      return { errors, value: null };
    }

    // Command Injection Protection
    if (this.containsCommandInjection(strValue)) {
      errors.push(`${fieldName} contains potentially malicious commands`);
      return { errors, value: null };
    }

    // Length validation
    if (rules.minLength && strValue.length < rules.minLength) {
      errors.push(`${fieldName} must be at least ${rules.minLength} characters long`);
    }

    if (rules.maxLength && strValue.length > rules.maxLength) {
      errors.push(`${fieldName} must not exceed ${rules.maxLength} characters`);
    }

    // Pattern validation
    if (rules.pattern && !rules.pattern.test(strValue)) {
      errors.push(`${fieldName} format is invalid`);
    }

    // Numeric validation
    if (rules.min !== undefined || rules.max !== undefined) {
      const numValue = parseFloat(strValue);
      if (isNaN(numValue)) {
        errors.push(`${fieldName} must be a valid number`);
      } else {
        if (rules.min !== undefined && numValue < rules.min) {
          errors.push(`${fieldName} must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && numValue > rules.max) {
          errors.push(`${fieldName} must not exceed ${rules.max}`);
        }
      }
    }

    // File extension validation
    if (rules.allowedExtensions && fieldName.includes('file')) {
      const ext = strValue.toLowerCase().substring(strValue.lastIndexOf('.'));
      if (!rules.allowedExtensions.includes(ext)) {
        errors.push(`${fieldName} must have one of these extensions: ${rules.allowedExtensions.join(', ')}`);
      }
    }

    // Custom validation function
    if (rules.customValidator) {
      const customResult = rules.customValidator(strValue, context);
      if (customResult !== true) {
        errors.push(customResult || `${fieldName} failed custom validation`);
      }
    }

    // Sanitization
    if (errors.length === 0) {
      sanitizedValue = this.sanitizeValue(strValue, rules);
    }

    return {
      errors,
      value: sanitizedValue
    };
  }

  /**
   * Detects XSS attempts
   */
  containsXSS(value) {
    return this.xssPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Detects SQL injection attempts
   */
  containsSQLInjection(value) {
    return this.sqlPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Detects command injection attempts
   */
  containsCommandInjection(value) {
    return this.commandPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Sanitizes input values
   */
  sanitizeValue(value, rules) {
    let sanitized = value;

    // HTML encoding for display
    if (rules.htmlEncode !== false) {
      sanitized = this.htmlEncode(sanitized);
    }

    // Trim whitespace
    if (rules.trim !== false) {
      sanitized = sanitized.trim();
    }

    // Normalize unicode
    if (rules.normalize !== false) {
      sanitized = sanitized.normalize('NFKC');
    }

    return sanitized;
  }

  /**
   * HTML encoding to prevent XSS
   */
  htmlEncode(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * URL encoding
   */
  urlEncode(str) {
    return encodeURIComponent(str);
  }

  /**
   * Validates apartment data
   */
  validateApartmentData(data) {
    const schema = {
      title: { ...this.schemas.name, maxLength: 200 },
      description: { maxLength: 2000, pattern: /^[a-zA-Z0-9äöüßÄÖÜ\s.,:;!?()-]*$/ },
      price: this.schemas.price,
      address: this.schemas.address,
      postalCode: this.schemas.postalCode,
      city: { ...this.schemas.name, maxLength: 100 },
      size: { pattern: /^\d+(\.\d{1,2})?$/, min: 10, max: 10000 },
      rooms: { pattern: /^\d+(\.\d{1})?$/, min: 0.5, max: 20 },
      type: { pattern: /^(apartment|house|studio|shared|commercial)$/, required: true }
    };

    return this.validate(data, schema);
  }

  /**
   * Validates user authentication data
   */
  validateAuthData(data) {
    const schema = {
      email: this.schemas.email,
      password: this.schemas.password
    };

    return this.validate(data, schema);
  }

  /**
   * Validates user registration data
   */
  validateRegistrationData(data) {
    const schema = {
      email: this.schemas.email,
      password: this.schemas.password,
      firstName: { ...this.schemas.name, maxLength: 50 },
      lastName: { ...this.schemas.name, maxLength: 50 },
      phone: this.schemas.phone,
      userType: { pattern: /^(tenant|landlord)$/, required: true }
    };

    // Custom password confirmation validation
    schema.confirmPassword = {
      required: true,
      customValidator: (value, context) => {
        return value === data.password || 'Passwords do not match';
      }
    };

    return this.validate(data, schema);
  }

  /**
   * Validates search parameters
   */
  validateSearchData(data) {
    const schema = {
      query: this.schemas.searchQuery,
      minPrice: { pattern: /^\d+(\.\d{1,2})?$/, min: 0, max: 999999 },
      maxPrice: { pattern: /^\d+(\.\d{1,2})?$/, min: 0, max: 999999 },
      city: { ...this.schemas.name, maxLength: 100 },
      postalCode: { pattern: /^\d{5}$/ },
      minSize: { pattern: /^\d+$/, min: 1, max: 10000 },
      maxSize: { pattern: /^\d+$/, min: 1, max: 10000 },
      rooms: { pattern: /^\d+(\.\d{1})?$/, min: 0.5, max: 20 },
      type: { pattern: /^(apartment|house|studio|shared|commercial)$/ }
    };

    return this.validate(data, schema);
  }

  /**
   * Validates file upload data
   */
  validateFileUpload(file, maxSize = 10 * 1024 * 1024) { // 10MB default
    const errors = [];

    if (!file) {
      errors.push('No file provided');
      return { valid: false, errors };
    }

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      errors.push('Invalid file type. Allowed types: JPEG, PNG, PDF, DOC, DOCX');
    }

    // Check filename
    const filename = file.name || '';
    const result = this.validateField('filename', filename, this.schemas.fileName);
    errors.push(...result.errors);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates CSRF token
   */
  validateCSRFToken(providedToken, sessionToken) {
    if (!providedToken || !sessionToken) {
      return false;
    }

    // Simple constant-time comparison to prevent timing attacks
    return this.safeCompare(providedToken, sessionToken);
  }

  /**
   * Safe string comparison to prevent timing attacks
   */
  safeCompare(a, b) {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Validates tenant screening data
   */
  validateTenantScreeningData(data) {
    const schema = {
      firstName: { ...this.schemas.name, maxLength: 50 },
      lastName: { ...this.schemas.name, maxLength: 50 },
      dateOfBirth: { pattern: /^\d{4}-\d{2}-\d{2}$/, required: true },
      employerName: { maxLength: 200, pattern: /^[a-zA-Z0-9äöüßÄÖÜ\s.,-&]+$/ },
      monthlyIncome: { pattern: /^\d+(\.\d{1,2})?$/, min: 0, max: 999999 },
      employmentType: { pattern: /^(permanent|temporary|freelance|unemployed|student|retired)$/ },
      previousLandlordName: { maxLength: 200, pattern: /^[a-zA-Z0-9äöüßÄÖÜ\s.,-&]*$/ },
      previousLandlordPhone: this.schemas.phone,
      currentAddress: { ...this.schemas.address, required: true },
      moveInDate: { pattern: /^\d{4}-\d{2}-\d{2}$/ },
      schufaConsent: { pattern: /^(true|false)$/, required: true }
    };

    return this.validate(data, schema);
  }
}

// Export singleton instance
export const validator = new InputValidator();

// Convenience functions
export const validateInput = (data, schema, context) => validator.validate(data, schema, context);
export const sanitizeHTML = (str) => validator.htmlEncode(str);
export const validateAuth = (data) => validator.validateAuthData(data);
export const validateRegistration = (data) => validator.validateRegistrationData(data);
export const validateApartment = (data) => validator.validateApartmentData(data);
export const validateSearch = (data) => validator.validateSearchData(data);
export const validateFile = (file, maxSize) => validator.validateFileUpload(file, maxSize);
export const validateCSRF = (token, session) => validator.validateCSRFToken(token, session);

export default validator;