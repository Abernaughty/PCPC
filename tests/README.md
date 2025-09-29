# PCPC Testing Framework

## Overview

This directory contains the comprehensive testing framework for the Pokemon Card Price Checker (PCPC) project, implementing enterprise-grade testing practices following the Test Pyramid pattern.

## Testing Architecture

```
        /\
       /  \     E2E Tests (Few, High Value)
      /____\    - Playwright browser automation
     /      \   - Critical user journeys
    /________\  - Cross-browser compatibility
   /          \ Integration Tests (Some)
  /____________\ - API integration testing
                 - Database integration
                 - Service integration

                 Unit Tests (Many, Fast)
                 - Jest for frontend/backend
                 - High coverage, isolated
                 - Fast feedback loop
```

## Directory Structure

```
tests/
├── README.md                    # This file - testing framework overview
├── config/                      # Shared testing configurations
│   ├── jest.config.js          # Jest configuration for unit tests
│   ├── playwright.config.ts    # Playwright configuration for E2E tests
│   ├── test-setup.js           # Global test setup and utilities
│   └── test-helpers.js         # Shared testing helper functions
├── frontend/                    # Frontend testing suite
│   ├── components/             # Svelte component unit tests
│   ├── services/               # Service layer unit tests
│   ├── stores/                 # Store unit tests
│   ├── integration/            # Frontend integration tests
│   └── __mocks__/              # Frontend mocks and fixtures
├── backend/                     # Backend testing suite
│   ├── functions/              # Azure Functions unit tests
│   ├── services/               # Service layer unit tests
│   ├── utils/                  # Utility function tests
│   ├── integration/            # Backend integration tests
│   ├── contracts/              # API contract tests
│   └── __mocks__/              # Backend mocks and fixtures
├── e2e/                        # End-to-end testing suite
│   ├── frontend/               # Frontend E2E tests
│   ├── api/                    # API E2E tests
│   ├── fixtures/               # Test data and fixtures
│   └── page-objects/           # Page object models
├── infrastructure/             # Infrastructure testing suite
│   ├── modules/                # Terraform module tests
│   ├── environments/           # Environment deployment tests
│   ├── integration/            # Infrastructure integration tests
│   └── security/               # Security and compliance tests
├── performance/                # Performance testing suite
│   ├── load/                   # Load testing scripts (K6)
│   ├── stress/                 # Stress testing scenarios
│   ├── benchmarks/             # Performance benchmarks
│   └── reports/                # Performance test reports
└── security/                   # Security testing suite
    ├── vulnerability/          # Vulnerability scanning
    ├── compliance/             # Compliance testing
    └── penetration/            # Penetration testing scripts
```

## Testing Tools and Frameworks

### Unit Testing

- **Jest**: JavaScript/TypeScript unit testing framework
- **@testing-library/svelte**: Svelte component testing utilities
- **@testing-library/jest-dom**: Custom Jest matchers for DOM testing

### Integration Testing

- **Supertest**: HTTP assertion library for API testing
- **@azure/cosmos**: Cosmos DB integration testing
- **testcontainers**: Container-based integration testing

### End-to-End Testing

- **Playwright**: Modern browser automation framework
- **@playwright/test**: Playwright test runner
- Cross-browser testing (Chrome, Firefox, Safari)

### Infrastructure Testing

- **Terratest**: Go-based infrastructure testing framework
- **Azure SDK**: Azure resource validation
- **Checkov**: Infrastructure security scanning

### Performance Testing

- **K6**: Modern load testing framework
- **Artillery**: Alternative load testing tool
- **Lighthouse CI**: Performance auditing

### Security Testing

- **npm audit**: Dependency vulnerability scanning
- **Snyk**: Security vulnerability detection
- **OWASP ZAP**: Security testing proxy

## Running Tests

### All Tests

```bash
# Run all test suites
make test

# Run tests with coverage
make test-coverage

# Run tests in watch mode
make test-watch
```

### Unit Tests

```bash
# Frontend unit tests
npm run test:frontend

# Backend unit tests
npm run test:backend

# Specific test file
npm test -- tests/frontend/components/SearchableSelect.test.js
```

### Integration Tests

```bash
# Frontend integration tests
npm run test:frontend:integration

# Backend integration tests
npm run test:backend:integration

# Infrastructure tests
npm run test:infrastructure
```

### End-to-End Tests

```bash
# All E2E tests
npm run test:e2e

# Specific browser
npm run test:e2e -- --project=chromium

# Headed mode (visible browser)
npm run test:e2e -- --headed
```

### Performance Tests

```bash
# Load tests
npm run test:performance

# Specific load test
k6 run tests/performance/load/api-endpoints.js
```

### Security Tests

```bash
# Security scan
npm run test:security

# Vulnerability scan
npm audit
```

## Test Data Management

### Fixtures

- Test data stored in `fixtures/` directories
- JSON files for API responses
- Mock data for database operations
- Sample files for file upload testing

### Mocks

- Service mocks in `__mocks__/` directories
- External API mocks
- Database operation mocks
- File system operation mocks

## Continuous Integration

### GitHub Actions Integration

```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: |
    npm run test:unit
    npm run test:integration
    npm run test:e2e
    npm run test:security
```

### Test Reporting

- Jest coverage reports
- Playwright HTML reports
- Performance test results
- Security scan reports

## Best Practices

### Unit Tests

- Test one thing at a time
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Aim for high coverage (>80%)

### Integration Tests

- Test real interactions between components
- Use test databases/containers
- Clean up after each test
- Test error scenarios

### E2E Tests

- Focus on critical user journeys
- Use page object models
- Keep tests independent
- Test across different browsers

### Performance Tests

- Establish baseline metrics
- Test under realistic load
- Monitor resource usage
- Set performance budgets

### Security Tests

- Regular vulnerability scanning
- Test authentication/authorization
- Validate input sanitization
- Check for common vulnerabilities

## Coverage Goals

- **Unit Tests**: >90% code coverage
- **Integration Tests**: >80% API endpoint coverage
- **E2E Tests**: 100% critical user journey coverage
- **Performance Tests**: All public endpoints tested
- **Security Tests**: All attack vectors covered

## Troubleshooting

### Common Issues

1. **Test timeouts**: Increase timeout values in configuration
2. **Flaky tests**: Add proper waits and assertions
3. **Mock issues**: Verify mock implementations match real services
4. **Environment issues**: Ensure test environment is properly configured

### Debug Mode

```bash
# Debug Jest tests
npm run test:debug

# Debug Playwright tests
npm run test:e2e:debug

# Verbose output
npm test -- --verbose
```

## Contributing

### Adding New Tests

1. Follow existing naming conventions
2. Add tests to appropriate directory
3. Update this README if adding new test types
4. Ensure tests pass in CI/CD pipeline

### Test Naming Conventions

- Unit tests: `ComponentName.test.js`
- Integration tests: `ServiceName.integration.test.js`
- E2E tests: `user-journey-name.e2e.test.js`
- Performance tests: `endpoint-name.load.test.js`

This testing framework ensures comprehensive coverage across all layers of the PCPC application, providing confidence in code quality, performance, and security.
