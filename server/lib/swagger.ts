import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Agart POS API',
    version: '1.0.0',
    description: `
## Agart POS - Point of Sale System API

A comprehensive REST API for managing retail and restaurant operations.

### Authentication
Most endpoints require session-based authentication. Use the \`/api/auth/login\` endpoint with staff PIN to authenticate.

### Business Unit Scoping
All data is scoped by \`businessUnitId\`. Pass this as a query parameter or in the request body.

### Roles
- **owner**: Full access to all business units and operations
- **manager**: Can manage inventory, staff, and view reports
- **cashier**: Can process sales and view customers
- **kitchen**: Limited to kitchen ticket operations (restaurant mode)
    `,
    contact: {
      name: 'Agart POS Support',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'API Server',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Sales', description: 'Sales and transactions' },
    { name: 'Products', description: 'Product/Inventory management' },
    { name: 'Customers', description: 'Customer management and credit' },
    { name: 'Staff', description: 'Staff management' },
    { name: 'Shifts', description: 'Shift and attendance tracking' },
    { name: 'Business Units', description: 'Store/Restaurant management' },
  ],
  components: {
    securitySchemes: {
      sessionAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'connect.sid',
        description: 'Session cookie from login',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Error message' },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          price: { type: 'number' },
          cost: { type: 'number', nullable: true },
          barcode: { type: 'string', nullable: true },
          stock: { type: 'integer' },
          minStockLevel: { type: 'integer' },
          unit: { type: 'string' },
          category: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['active', 'archived'] },
          businessUnitId: { type: 'string', nullable: true },
        },
      },
      Customer: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          phone: { type: 'string', nullable: true },
          email: { type: 'string', nullable: true },
          creditLimit: { type: 'number' },
          currentBalance: { type: 'number' },
          loyaltyPoints: { type: 'integer' },
          riskTag: { type: 'string', enum: ['low', 'high'] },
          businessUnitId: { type: 'string', nullable: true },
        },
      },
      Sale: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/SaleItem' },
          },
          subtotal: { type: 'number' },
          discount: { type: 'number' },
          tax: { type: 'number' },
          total: { type: 'number' },
          paymentMethod: { type: 'string', enum: ['cash', 'card', 'credit', 'mobile'] },
          paymentStatus: { type: 'string', enum: ['paid', 'unpaid'] },
          customerId: { type: 'string', nullable: true },
          businessUnitId: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      SaleItem: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          productName: { type: 'string' },
          quantity: { type: 'integer' },
          unitPrice: { type: 'number' },
          total: { type: 'number' },
        },
      },
      Staff: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['owner', 'manager', 'cashier', 'kitchen'] },
          status: { type: 'string', enum: ['active', 'suspended'] },
          businessUnitId: { type: 'string', nullable: true },
        },
      },
      Shift: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          staffId: { type: 'string' },
          staffName: { type: 'string' },
          businessUnitId: { type: 'string' },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time', nullable: true },
          openingCash: { type: 'number' },
          closingCash: { type: 'number', nullable: true },
          status: { type: 'string', enum: ['open', 'closed'] },
          totalSales: { type: 'number' },
        },
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with staff PIN',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['pin'],
                properties: {
                  pin: { type: 'string', description: '4-digit PIN', example: '1234' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Login successful' },
          401: { description: 'Invalid PIN or suspended account' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout current session',
        security: [{ sessionAuth: [] }],
        responses: {
          200: { description: 'Logged out' },
        },
      },
    },
    '/sales': {
      get: {
        tags: ['Sales'],
        summary: 'List all sales',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'businessUnitId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Filter by date (YYYY-MM-DD)' },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: {
            description: 'List of sales',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Sale' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Sales'],
        summary: 'Create a new sale',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items', 'paymentMethod', 'businessUnitId'],
                properties: {
                  items: { type: 'array', items: { $ref: '#/components/schemas/SaleItem' } },
                  paymentMethod: { type: 'string', enum: ['cash', 'card', 'credit', 'mobile'] },
                  customerId: { type: 'string', description: 'Required for credit sales' },
                  businessUnitId: { type: 'string' },
                  discount: { type: 'number' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Sale created' },
          400: { description: 'Invalid sale data' },
        },
      },
    },
    '/products': {
      get: {
        tags: ['Products'],
        summary: 'List all products',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'businessUnitId', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'List of products',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Create a new product',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'price'],
                properties: {
                  name: { type: 'string' },
                  price: { type: 'number' },
                  cost: { type: 'number' },
                  barcode: { type: 'string' },
                  stock: { type: 'integer' },
                  minStockLevel: { type: 'integer' },
                  unit: { type: 'string' },
                  category: { type: 'string' },
                  businessUnitId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Product created' },
          400: { description: 'Invalid product data' },
        },
      },
    },
    '/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get product by ID',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Product details' },
          404: { description: 'Product not found' },
        },
      },
      patch: {
        tags: ['Products'],
        summary: 'Update a product',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Product updated' },
          404: { description: 'Product not found' },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Archive a product',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          204: { description: 'Product archived' },
          404: { description: 'Product not found' },
        },
      },
    },
    '/inventory/{id}/stock': {
      patch: {
        tags: ['Products'],
        summary: 'Update product stock',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['quantity', 'type'],
                properties: {
                  quantity: { type: 'integer' },
                  type: { type: 'string', enum: ['stock-in', 'adjustment'] },
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Stock updated' },
          404: { description: 'Product not found' },
        },
      },
    },
    '/customers': {
      get: {
        tags: ['Customers'],
        summary: 'List all customers',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'businessUnitId', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'List of customers',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Customer' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Customers'],
        summary: 'Create a new customer',
        security: [{ sessionAuth: [] }],
        responses: {
          201: { description: 'Customer created' },
          400: { description: 'Invalid customer data' },
        },
      },
    },
    '/customers/{id}/repayment': {
      post: {
        tags: ['Customers'],
        summary: 'Record a debt repayment',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['amount', 'businessUnitId'],
                properties: {
                  amount: { type: 'number' },
                  description: { type: 'string' },
                  businessUnitId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Repayment recorded' },
          404: { description: 'Customer not found' },
        },
      },
    },
    '/staff': {
      get: {
        tags: ['Staff'],
        summary: 'List all staff members',
        security: [{ sessionAuth: [] }],
        responses: {
          200: {
            description: 'List of staff',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Staff' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Staff'],
        summary: 'Create a new staff member',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'pin', 'role'],
                properties: {
                  name: { type: 'string' },
                  pin: { type: 'string', minLength: 4, maxLength: 4 },
                  role: { type: 'string', enum: ['owner', 'manager', 'cashier', 'kitchen'] },
                  businessUnitId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Staff created' },
          400: { description: 'Invalid data or PIN already exists' },
        },
      },
    },
    '/shifts': {
      get: {
        tags: ['Shifts'],
        summary: 'List all shifts',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'businessUnitId', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'List of shifts',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Shift' } },
              },
            },
          },
        },
      },
    },
    '/shifts/current': {
      get: {
        tags: ['Shifts'],
        summary: 'Get current active shift',
        security: [{ sessionAuth: [] }],
        responses: {
          200: { description: 'Current shift info' },
        },
      },
    },
    '/attendance/clock-in': {
      post: {
        tags: ['Shifts'],
        summary: 'Clock in to start a shift',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['staffId', 'openingCash', 'businessUnitId'],
                properties: {
                  staffId: { type: 'string' },
                  openingCash: { type: 'number' },
                  businessUnitId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Clocked in successfully' },
          400: { description: 'Already clocked in' },
        },
      },
    },
    '/attendance/clock-out': {
      post: {
        tags: ['Shifts'],
        summary: 'Clock out to end a shift',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['closingCash'],
                properties: {
                  closingCash: { type: 'number' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Clocked out successfully' },
          400: { description: 'No active shift' },
        },
      },
    },
    '/business-units': {
      get: {
        tags: ['Business Units'],
        summary: 'List all business units (stores)',
        security: [{ sessionAuth: [] }],
        responses: {
          200: { description: 'List of business units' },
        },
      },
      post: {
        tags: ['Business Units'],
        summary: 'Create a new business unit',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'type'],
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['grocery', 'restaurant', 'pharmacy', 'electronics', 'clothing'] },
                  settings: { type: 'string', description: 'JSON string of store settings' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Business unit created' },
        },
      },
    },
  },
};

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: [], // We define everything in swaggerDefinition above
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Agart POS API Documentation',
  }));

  // Serve raw OpenAPI spec as JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('API Documentation available at /api-docs');
}
