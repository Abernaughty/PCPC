# PCPC Database Schema Management

## Overview

This directory contains the complete database schema management system for the Pokemon Card Price Checker (PCPC) project. It provides enterprise-grade database schema documentation, migration framework, seed data management, and operational tools for Azure Cosmos DB.

## Directory Structure

```
db/
├── schemas/           # Schema definitions and documentation
│   ├── containers/    # Container schema definitions (JSON Schema)
│   ├── indexes/       # Indexing policies and strategies
│   └── partitioning/  # Partition key strategies and documentation
├── migrations/        # Database migration framework
│   ├── scripts/       # Version-controlled migration scripts
│   ├── framework/     # Migration execution and management tools
│   └── README.md      # Migration procedures and guidelines
├── seed-data/         # Development and testing seed data
│   ├── sets/          # Pokemon card sets data
│   ├── cards/         # Sample card data
│   ├── scripts/       # Seed data management tools
│   └── README.md      # Seed data procedures
├── docs/              # Database documentation
│   ├── schema-design.md        # Entity relationships and design
│   ├── performance-optimization.md  # Query and performance guidelines
│   ├── backup-recovery.md      # Operational procedures
│   └── troubleshooting.md      # Common issues and solutions
├── tools/             # Database management utilities
│   ├── schema-validator.js     # Schema validation tools
│   ├── performance-analyzer.js # Performance analysis utilities
│   └── data-export-import.js   # Data management tools
└── README.md          # This file
```

## Current Database Architecture

### Database: `PokemonCards`

The PCPC application uses Azure Cosmos DB with SQL API in serverless mode. The database contains the following containers:

#### Containers

1. **Sets** - Pokemon card set information

   - Partition Key: `/series`
   - Purpose: Store Pokemon card set metadata and release information

2. **Cards** - Individual Pokemon card data
   - Partition Key: `/setId`
   - Purpose: Store card details, pricing, and metadata

**Note**: The current implementation includes only these 2 containers. Additional containers (Cache, PricingHistory) may be added in future phases as the system evolves.

### Key Features

- **Enterprise Schema Management**: Formal schema definitions with validation
- **Migration Framework**: Version-controlled database changes with rollback capability
- **Seed Data System**: Consistent development and testing data
- **Performance Optimization**: Documented indexing and partitioning strategies
- **Operational Tools**: Database management and analysis utilities

## Quick Start

### Development Environment Setup

1. **Start DevContainer**: The database emulator starts automatically
2. **Seed Database**: Run seed data scripts for development
3. **Validate Schema**: Use schema validation tools

```bash
# Seed development database
cd db/seed-data/scripts
node seed-runner.js

# Validate schema
cd db/tools
node schema-validator.js
```

### Schema Management

1. **Review Schema**: Check `db/schemas/containers/` for current definitions
2. **Create Migration**: Add new migration script to `db/migrations/scripts/`
3. **Execute Migration**: Use migration framework for safe deployment

```bash
# Create new migration
cd db/migrations/scripts
cp template-migration.js 004-new-feature.js

# Execute migration
cd db/migrations/framework
node migration-runner.js --script 004-new-feature.js
```

## Integration Points

### Backend Services

- **CosmosDbService**: Uses formal schema validation
- **Data Models**: TypeScript interfaces match JSON Schema definitions
- **API Functions**: Schema validation in data operations

### Infrastructure as Code

- **Terraform Modules**: Container definitions and indexing policies
- **Deployment Pipelines**: Automated migration execution
- **Environment Management**: Schema consistency across environments

### Development Workflow

- **DevContainer**: Automated database setup and seeding
- **Build Process**: Schema validation in CI/CD
- **Testing**: Consistent seed data for all environments

## Documentation

- **[Schema Design](docs/schema-design.md)**: Entity relationships and design decisions
- **[Performance Optimization](docs/performance-optimization.md)**: Query optimization and indexing
- **[Migration Guide](migrations/README.md)**: Database change management procedures
- **[Seed Data Guide](seed-data/README.md)**: Development data management
- **[Backup & Recovery](docs/backup-recovery.md)**: Operational procedures
- **[Troubleshooting](docs/troubleshooting.md)**: Common issues and solutions

## Enterprise Standards

This database schema management system demonstrates:

- **Version Control**: All schema changes tracked and versioned
- **Risk Mitigation**: Rollback capabilities and validation
- **Documentation**: Comprehensive schema and operational documentation
- **Automation**: Integrated with CI/CD and development workflows
- **Performance**: Optimized indexing and partitioning strategies
- **Consistency**: Identical schemas across all environments

## Support

For questions or issues with the database schema management system:

1. Check the [Troubleshooting Guide](docs/troubleshooting.md)
2. Review the [Schema Documentation](docs/schema-design.md)
3. Consult the [Migration Procedures](migrations/README.md)

---

**Note**: This database schema management system is part of the PCPC enterprise architecture, demonstrating advanced database design and operational practices for portfolio and production use.
