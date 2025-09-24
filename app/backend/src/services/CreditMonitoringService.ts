import { cosmosDbService } from '../index';

export interface CreditStatus {
  creditsRemaining: number;
  creditLimit?: number;
  usagePercentage?: number;
  lastChecked: Date;
  status: 'healthy' | 'warning' | 'critical' | 'exhausted';
  previousCredits?: number;
  usageSinceLastCheck?: number;
}

export interface CreditEvent {
  timestamp: Date;
  eventType: 'check' | 'error' | 'alert' | 'anomaly';
  creditsRemaining: number;
  operation: string;
  functionName: string;
  correlationId: string;
  details?: any;
}

export interface CreditMonitoringData {
  id: string; // ISO timestamp
  timestamp: Date;
  creditsRemaining: number;
  creditLimit?: number;
  usageSince6HoursAgo?: number;
  usageRate?: number; // credits per hour
  projectedExhaustionDate?: Date;
  anomalyDetected: boolean;
  functions: {
    refreshData: number;
    getCardInfo: number;
    getCardsBySet: number;
    estimated: number;
  };
  alerts: string[];
}

export class CreditMonitoringService {
  private lastKnownCredits: number | null = null;
  private alertThresholds = {
    warning: 0.2,   // 20% remaining
    critical: 0.1,  // 10% remaining
    emergency: 0.05 // 5% remaining
  };
  
  // Standard monthly credit limits for different plans
  private readonly STANDARD_MONTHLY_LIMIT = 30000; // User's confirmed monthly limit

  /**
   * Determine health status based on credits remaining
   * Optimized for 30K monthly limit with percentage-based thresholds
   */
  private determineHealthStatus(credits: number, limit?: number): CreditStatus['status'] {
    if (credits <= 0) return 'exhausted';
    
    // Use provided limit or fall back to standard monthly limit
    const creditLimit = limit || this.STANDARD_MONTHLY_LIMIT;
    const percentage = credits / creditLimit;
    
    // Percentage-based thresholds (optimized for 30K monthly limit)
    if (percentage <= this.alertThresholds.emergency) return 'critical';  // ≤5% (≤1,500)
    if (percentage <= this.alertThresholds.critical) return 'critical';   // ≤10% (≤3,000)
    if (percentage <= this.alertThresholds.warning) return 'warning';     // ≤20% (≤6,000)
    
    return 'healthy'; // >20% (>6,000)
  }

  /**
   * Calculate usage rate and detect anomalies
   */
  private async detectUnusualUsage(currentCredits: number): Promise<boolean> {
    try {
      // Get recent monitoring data to calculate usage trends
      const recentData = await this.getRecentMonitoringData(24); // Last 24 hours
      
      if (recentData.length < 2) {
        return false; // Not enough data to detect anomalies
      }
      
      // Calculate average usage rate from recent data
      const usageRates = recentData.map(data => data.usageRate || 0).filter(rate => rate > 0);
      if (usageRates.length === 0) return false;
      
      const averageUsageRate = usageRates.reduce((sum, rate) => sum + rate, 0) / usageRates.length;
      
      // Get current usage rate (credits consumed in last 6 hours)
      const sixHoursAgo = new Date(Date.now() - (6 * 60 * 60 * 1000));
      const dataFromSixHoursAgo = recentData.find(data => 
        new Date(data.timestamp) <= sixHoursAgo
      );
      
      if (dataFromSixHoursAgo) {
        const currentUsageRate = (dataFromSixHoursAgo.creditsRemaining - currentCredits) / 6;
        
        // Anomaly if current usage is 3x higher than average
        return currentUsageRate > (averageUsageRate * 3);
      }
      
      return false;
    } catch (error) {
      console.error(`[CreditMonitoringService] Error detecting unusual usage: ${error}`);
      return false;
    }
  }

  /**
   * Get recent monitoring data from Cosmos DB
   */
  private async getRecentMonitoringData(hoursBack: number): Promise<CreditMonitoringData[]> {
    try {
      const cutoffTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));
      
      // Note: This would need to be implemented in CosmosDbService
      // For now, return empty array
      return [];
    } catch (error) {
      console.error(`[CreditMonitoringService] Error getting recent monitoring data: ${error}`);
      return [];
    }
  }

  /**
   * Log a credit-related event
   */
  async logCreditEvent(event: CreditEvent): Promise<void> {
    try {
      const logEntry = {
        ...event,
        id: `credit-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        container: 'credit-events' // For Cosmos DB partitioning
      };
      
      console.log(`[CreditMonitoringService] Credit Event: ${event.eventType} - ${event.creditsRemaining} credits remaining (${event.operation})`);
      
      // Store in Cosmos DB for historical analysis
      // Note: This would need to be implemented in CosmosDbService
      // await cosmosDbService.saveCreditEvent(logEntry);
      
    } catch (error) {
      console.error(`[CreditMonitoringService] Error logging credit event: ${error}`);
    }
  }

  /**
   * Generate alerts based on credit status
   */
  private async generateAlerts(creditStatus: CreditStatus, correlationId: string): Promise<string[]> {
    const alerts: string[] = [];
    
    switch (creditStatus.status) {
      case 'exhausted':
        alerts.push(`🚨 CRITICAL: PokeData API credits exhausted! Service interruption imminent.`);
        break;
      case 'critical':
        alerts.push(`🔴 CRITICAL: Only ${creditStatus.creditsRemaining} PokeData API credits remaining!`);
        if (creditStatus.usagePercentage) {
          alerts.push(`📉 Usage: ${(creditStatus.usagePercentage * 100).toFixed(1)}% of quota consumed`);
        }
        break;
      case 'warning':
        alerts.push(`🟡 WARNING: PokeData API credits running low (${creditStatus.creditsRemaining} remaining)`);
        break;
    }
    
    if (creditStatus.usageSinceLastCheck && creditStatus.usageSinceLastCheck > 100) {
      alerts.push(`📈 HIGH USAGE: ${creditStatus.usageSinceLastCheck} credits consumed since last check`);
    }
    
    return alerts;
  }

  /**
   * Save monitoring data to Cosmos DB
   */
  async saveMonitoringData(data: CreditMonitoringData): Promise<void> {
    try {
      const monitoringEntry = {
        ...data,
        container: 'credit-monitoring' // For Cosmos DB partitioning
      };
      
      console.log(`[CreditMonitoringService] Saving monitoring data: ${data.creditsRemaining} credits remaining`);
      
      // Store in Cosmos DB for historical analysis
      // Note: This would need to be implemented in CosmosDbService
      // await cosmosDbService.saveMonitoringData(monitoringEntry);
      
    } catch (error) {
      console.error(`[CreditMonitoringService] Error saving monitoring data: ${error}`);
    }
  }

  /**
   * Main method to process credit status and generate comprehensive monitoring data
   */
  async processCreditStatus(
    credits: number,
    operation: string,
    functionName: string,
    correlationId: string
  ): Promise<CreditStatus> {
    try {
      const now = new Date();
      const usageSinceLastCheck = this.lastKnownCredits ? (this.lastKnownCredits - credits) : 0;
      
      // Create credit status with percentage information
      const creditLimit = this.STANDARD_MONTHLY_LIMIT;
      const usagePercentage = (creditLimit - credits) / creditLimit;
      
      const creditStatus: CreditStatus = {
        creditsRemaining: credits,
        creditLimit,
        usagePercentage,
        lastChecked: now,
        status: this.determineHealthStatus(credits, creditLimit),
        previousCredits: this.lastKnownCredits || undefined,
        usageSinceLastCheck: usageSinceLastCheck > 0 ? usageSinceLastCheck : undefined
      };
      
      // Detect anomalies
      const anomalyDetected = await this.detectUnusualUsage(credits);
      
      // Generate alerts
      const alerts = await this.generateAlerts(creditStatus, correlationId);
      
      // Log credit event
      await this.logCreditEvent({
        timestamp: now,
        eventType: creditStatus.status === 'healthy' ? 'check' : 'alert',
        creditsRemaining: credits,
        operation,
        functionName,
        correlationId,
        details: { usageSinceLastCheck, anomalyDetected }
      });
      
      // Log alerts
      if (alerts.length > 0) {
        console.warn(`${correlationId} CREDIT ALERTS:`);
        alerts.forEach(alert => console.warn(`${correlationId} ${alert}`));
      }
      
      // Update last known credits
      this.lastKnownCredits = credits;
      
      return creditStatus;
      
    } catch (error) {
      console.error(`[CreditMonitoringService] Error processing credit status: ${error}`);
      
      // Return basic status on error
      return {
        creditsRemaining: credits,
        lastChecked: new Date(),
        status: 'healthy'
      };
    }
  }
}
