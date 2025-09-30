# PCPC Database Partitioning Strategy

## Overview

This document outlines the comprehensive partitioning strategy for the PCPC (Pokemon Card Price Checker) database. Proper partitioning is critical for achieving optimal performance, scalability, and cost efficiency in Azure Cosmos DB.

## Partitioning Principles

### Core Concepts

1. **Logical Partitions**: Groups of items that share the same partition key value
2. **Physical Partitions**: Storage and compute units that contain one or more logical partitions
3. **Partition Key**: The property used to distribute data across partitions
4. **Hot Partitions**: Partitions that receive disproportionately high traffic

### Design Goals

- **Even Distribution**: Spread data and traffic evenly across partitions
- **Query Efficiency**: Enable single-partition queries for common operations
- **Scalability**: Support growth without performance degradation
- **Cost Optimization**: Minimize Request Unit (RU) consumption

## Container Partitioning Strategies

### 1. Sets Container

**Partition Key**: `/series`

**Rationale**:

- Pokemon card sets are naturally grouped by series/generation
- Series provide good cardinality (10-15 distinct values)
- Most queries filter by series or access all sets
- Even distribution across series over time

**Partition Distribution**:

```
Series                 | Estimated Sets | Data Size | Query Frequency
-----------------------|----------------|-----------|----------------
PokeData              | 50-100         | 2-4 MB    | High
Scarlet & Violet      | 15-25          | 1-2 MB    | High
Sword & Shield        | 20-30          | 1-2 MB    | Medium
Sun & Moon            | 25-35          | 1-2 MB    | Low
XY                    | 15-25          | 1-2 MB    | Low
Black & White         | 15-25          | 1-2 MB    | Low
```

**Query Patterns**:

- Single-partition: `WHERE series = 'PokeData'` (2-5 RU)
- Cross-partition: `WHERE isCurrent = true` (5-15 RU)

**Hot Partition Risk**: **Medium** - PokeData series may receive more traffic

### 2. Cards Container

**Partition Key**: `/setId`

**Rationale**:

- Cards are primarily accessed by set
- SetId provides excellent cardinality (100+ distinct values)
- Enables efficient single-partition queries for set-based operations
- Natural data locality for related cards

**Partition Distribution**:

```
Set Type              | Cards per Set | Data Size | Query Frequency
----------------------|---------------|-----------|----------------
Current Sets (5-10)   | 150-300       | 5-15 MB   | Very High
Recent Sets (10-20)   | 150-300       | 5-15 MB   | High
Older Sets (100+)     | 100-250       | 3-10 MB   | Low-Medium
```

**Query Patterns**:

- Single-partition: `WHERE setId = 557` (2-5 RU)
- Cross-partition: `WHERE cardName LIKE '%Pikachu%'` (10-50 RU)

**Hot Partition Risk**: **High** - Current/popular sets receive most traffic

**Note**: Additional containers (Cache, PricingHistory) may be added in future phases as the system evolves.

## Partition Key Selection Criteria

### Evaluation Matrix

| Container | Cardinality | Distribution | Query Alignment | Scalability | Score |
| --------- | ----------- | ------------ | --------------- | ----------- | ----- |
| Sets      | Medium (15) | Good         | Excellent       | Good        | 8/10  |
| Cards     | High (100+) | Good         | Excellent       | Excellent   | 9/10  |

**Note**: Additional containers may be evaluated and added in future phases.

### Selection Rationale

1. **Cardinality**: Sufficient distinct values to enable scaling
2. **Distribution**: Even spread of data and traffic
3. **Query Alignment**: Most queries can use single-partition operations
4. **Future Growth**: Partition strategy supports expected growth patterns

## Hot Partition Mitigation

### Identification

**Monitoring Metrics**:

- Request Unit consumption per partition
- Storage distribution across partitions
- Query frequency patterns
- Response time variations

**Warning Signs**:

- Single partition consuming >50% of total RUs
- Significant response time differences between partitions
- Throttling errors (429 status codes) on specific partitions

### Mitigation Strategies

#### 1. Cards Container (High Risk)

**Current Mitigation**:

- Batch operations within same partition (setId)
- Exclude large objects from indexing (pricing, image variants)
- Use efficient query patterns with setId filter

**Future Options**:

- Consider synthetic partition key: `${setId}-${cardNumber.slice(-1)}`
- Implement read replicas for popular sets
- Cache frequently accessed cards at application level

#### 2. Sets Container (Medium Risk)

**Current Mitigation**:

- Composite indexes for efficient cross-partition queries
- Selective field projection to reduce data transfer
- Cache current sets at application level

**Future Options**:

- Consider time-based partitioning for historical data
- Implement materialized views for common aggregations

## Performance Optimization Guidelines

### Query Design Patterns

#### Optimal Patterns

```sql
-- Single-partition queries (2-5 RU)
SELECT * FROM c WHERE c.setId = 557
SELECT * FROM c WHERE c.series = 'PokeData'

-- Efficient cross-partition with indexes (5-15 RU)
SELECT * FROM c WHERE c.isCurrent = true ORDER BY c.releaseDate DESC
SELECT * FROM c WHERE c.cardName = 'Pikachu' AND c.setId IN (557, 556)
```

#### Anti-Patterns to Avoid

```sql
-- Expensive cross-partition scans (50+ RU)
SELECT * FROM c WHERE CONTAINS(c.cardName, 'Charizard')
SELECT * FROM c ORDER BY c.lastUpdated DESC

-- Inefficient aggregations (100+ RU)
SELECT COUNT(*) FROM c WHERE c.rarity = 'Ultra Rare'
SELECT AVG(c.cardCount) FROM c
```

### Indexing Alignment

**Partition-Aligned Indexes**:

- Include partition key in composite indexes where possible
- Design indexes to support single-partition queries
- Exclude large nested objects from automatic indexing

**Cross-Partition Indexes**:

- Use composite indexes for common cross-partition queries
- Monitor RU consumption for cross-partition operations
- Consider query result caching for expensive operations

## Monitoring and Maintenance

### Key Metrics

1. **Partition Distribution**:

   - Storage size per logical partition
   - Request rate per logical partition
   - RU consumption distribution

2. **Query Performance**:

   - Average RU consumption by query type
   - Response time percentiles
   - Cross-partition vs single-partition query ratios

3. **Scaling Indicators**:
   - Partition count growth over time
   - Hot partition identification
   - Throttling error rates

### Maintenance Tasks

#### Daily

- Monitor partition-level RU consumption
- Check for throttling errors or hot partitions
- Review query performance metrics

#### Weekly

- Analyze partition distribution trends
- Review and optimize expensive queries
- Update partition strategy documentation if needed

#### Monthly

- Comprehensive partition performance review
- Evaluate need for partition key changes
- Plan for anticipated data growth

## Future Considerations

### Scaling Scenarios

1. **10x Data Growth**: Current partition strategy supports 10x growth
2. **100x Data Growth**: May require partition key refinement for Cards container
3. **Global Distribution**: Consider geo-partitioning for multi-region deployment
4. **Additional Containers**: Future containers (Cache, PricingHistory) will need partition strategy evaluation

### Technology Evolution

1. **Cosmos DB Updates**: Monitor new partitioning features and capabilities
2. **Query Optimization**: Leverage new indexing and query optimization features
3. **Cost Optimization**: Evaluate new pricing models and optimization opportunities

## Conclusion

The current partitioning strategy provides a solid foundation for the PCPC database with:

- **Excellent query performance** for common operations
- **Good scalability** to support anticipated growth
- **Manageable hot partition risk** with defined mitigation strategies
- **Clear monitoring and maintenance procedures**

Regular monitoring and proactive optimization will ensure continued performance as the system scales.

---

**Last Updated**: September 28, 2025  
**Next Review**: October 28, 2025  
**Owner**: PCPC Database Team
