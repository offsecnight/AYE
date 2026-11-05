import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title:       "AYE Platform API",
      version:     "1.0.0",
      description: "Zero-PII University Problem Tracking & Student Accountability Platform",
      contact: {
        name: "AYE Platform Dev",
      },
    },
    servers: [
      { url: "/api/v1", description: "Current environment" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type:         "http",
          scheme:       "bearer",
          bearerFormat: "JWT",
          description:  "Enter the JWT token from /auth/login or /auth/register",
        },
      },
      schemas: {
        College: {
          type: "object",
          properties: {
            college_id:        { type: "string", format: "uuid" },
            name:              { type: "string" },
            slug:              { type: "string" },
            city:              { type: "string" },
            reality_grade:     { type: "string", enum: ["A","B","C","D","F","N/A"] },
            resolution_rate:   { type: "number" },
            total_experiences: { type: "integer" },
            total_resolved:    { type: "integer" },
          },
        },
        Experience: {
          type: "object",
          properties: {
            post_id:        { type: "string", format: "uuid" },
            ghost_handle:   { type: "string" },
            title:          { type: "string" },
            what_is_wrong:  { type: "string" },
            exact_location: { type: "string" },
            impact_scope:   { type: "string" },
            category:       { type: "string", enum: ["HOSTEL","MESS_FOOD","LABS_WIFI","FEES_ADMIN","FACULTY","INFRASTRUCTURE","SAFETY"] },
            severity:       { type: "string", enum: ["NORMAL","HIGH","CRITICAL"] },
            status:         { type: "string", enum: ["UNRESOLVED","TRENDING","FIX_PROPOSED","RESOLVED","HIDDEN_JUNK"] },
            aye_count:      { type: "integer" },
            created_at:     { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Public",      description: "No authentication required" },
      { name: "Auth",        description: "Registration, login, recovery" },
      { name: "Experiences", description: "Campus Wall — problem posts" },
      { name: "Chat",        description: "AYE Lounge real-time chat" },
      { name: "DevAdmin",    description: "Developer Super-Admin only" },
    ],
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
