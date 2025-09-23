import { Timer, InvocationContext } from "@azure/functions";
import { pokeDataApiService } from "../../index";
import { CreditMonitoringService, CreditMonitoringData } from "../../services/CreditMonitoringService";

/**
 * MonitorCredits Function - Proactive Credit Monitoring
 * 
 * This function runs every 6 hours to monitor PokeData API credit usage:
 * 1. Checks current credit balance (FREE - no credits consumed)
 * 2. Tracks usage patterns and trends
 * 3. Detects anomalous consumption (like previous RefreshData issues)
 * 4. Generates alerts when credits are low
 * 5. Logs historical data for analysis
 * 
 * Scheduled to run: Every 6 hours (0 0 star slash 6 star star star)
 * This provides 4 data points per day for trend analysis
 */
export async function monitorCredits(myTimer: Timer, context: InvocationContext): Promise<void> {
  const timestamp = new Date().toISOString();
  const correlationId = `[credit-monitor-${Date.now()}]`;
  const startTime = Date.now();
  
  context.log(`${correlationId} Credit monitoring function executed at ${timestamp}`);
  
  try {
    // Step 1: Check current credit balance (FREE - no credits consumed)
    context.log(`${correlationId} Step 1: Checking PokeData API credit balance...`);
    const creditCheckStartTime = Date.now();
    
    const creditStatus = await pokeDataApiService.checkCreditsRemaining();
    const creditCheckTime = Date.now() - creditCheckStartTime;
    
    if (!creditStatus) {
      context.log(`${correlationId} ERROR: Unable to retrieve credit status (${creditCheckTime}ms)`);
      throw new Error("Failed to retrieve PokeData API credit status");
    }
    
    const { creditsRemaining, status } = creditStatus;
    context.log(`${correlationId} Current credit status: ${creditsRemaining} credits remaining (${status}) - ${creditCheckTime}ms`);
    
    // Step 2: Initialize credit monitoring service
    context.log(`${correlationId} Step 2: Initializing credit monitoring service...`);
    const creditMonitoringService = new CreditMonitoringService();
    
    // Step 3: Process credit status and generate monitoring data
    context.log(`${correlationId} Step 3: Processing credit status and generating alerts...`);
    const processingStartTime = Date.now();
    
    const processedStatus = await creditMonitoringService.processCreditStatus(
      creditsRemaining,
      'credit-monitoring',
      'MonitorCredits',
      correlationId
    );
    
    const processingTime = Date.now() - processingStartTime;
    context.log(`${correlationId} Credit status processed (${processingTime}ms) - Status: ${processedStatus.status}`);
    
    // Step 4: Create comprehensive monitoring data
    context.log(`${correlationId} Step 4: Creating comprehensive monitoring data structure...`);
    const monitoringData: CreditMonitoringData = {
      id: timestamp,
      timestamp: new Date(),
      creditsRemaining,
      anomalyDetected: false, // Will be enhanced with historical analysis
      functions: {
        refreshData: 0,    // Estimated daily usage
        getCardInfo: 0,    // Estimated daily usage  
        getCardsBySet: 0,  // Estimated daily usage
        estimated: 10      // Conservative estimate for monitoring
      },
      alerts: processedStatus.status !== 'healthy' ? [
        `Credit status: ${processedStatus.status}`,
        `Credits remaining: ${creditsRemaining}`
      ] : []
    };
    
    // Step 5: Log monitoring insights
    context.log(`${correlationId} Step 5: Logging monitoring insights...`);
    
    // Log credit trends and projections
    if (processedStatus.usageSinceLastCheck) {
      const dailyUsageEstimate = (processedStatus.usageSinceLastCheck / 6) * 24; // Scale 6-hour usage to daily
      const daysRemaining = creditsRemaining / Math.max(dailyUsageEstimate, 1);
      
      context.log(`${correlationId} 📊 Usage Analysis:`);
      context.log(`${correlationId} - Credits consumed since last check: ${processedStatus.usageSinceLastCheck}`);
      context.log(`${correlationId} - Estimated daily usage: ${dailyUsageEstimate.toFixed(1)} credits/day`);
      context.log(`${correlationId} - Estimated days remaining: ${daysRemaining.toFixed(1)} days`);
      
      // Update monitoring data with calculations
      monitoringData.usageSince6HoursAgo = processedStatus.usageSinceLastCheck;
      monitoringData.usageRate = dailyUsageEstimate;
      
      if (daysRemaining < 30) {
        const projectedExhaustionDate = new Date(Date.now() + (daysRemaining * 24 * 60 * 60 * 1000));
        monitoringData.projectedExhaustionDate = projectedExhaustionDate;
        context.log(`${correlationId} ⚠️  Projected exhaustion date: ${projectedExhaustionDate.toISOString()}`);
      }
      
      // Detect high usage anomalies
      if (dailyUsageEstimate > 100) { // More than 100 credits per day indicates potential issue
        monitoringData.anomalyDetected = true;
        monitoringData.alerts.push(`High usage detected: ${dailyUsageEstimate.toFixed(1)} credits/day`);
        context.log(`${correlationId} 🚨 ANOMALY DETECTED: High daily usage (${dailyUsageEstimate.toFixed(1)} credits/day)`);
      }
    }
    
    // Step 6: Save monitoring data for historical analysis
    context.log(`${correlationId} Step 6: Saving monitoring data...`);
    const saveStartTime = Date.now();
    
    await creditMonitoringService.saveMonitoringData(monitoringData);
    
    const saveTime = Date.now() - saveStartTime;
    context.log(`${correlationId} Monitoring data saved (${saveTime}ms)`);
    
    // Step 7: Generate summary and recommendations
    context.log(`${correlationId} Step 7: Generating final summary and recommendations...`);
    const totalTime = Date.now() - startTime;
    context.log(`${correlationId} ✅ Credit monitoring complete in ${totalTime}ms`);
    
    // Log summary based on status
    switch (processedStatus.status) {
      case 'healthy':
        context.log(`${correlationId} ✅ STATUS: Healthy - ${creditsRemaining} credits available`);
        break;
      case 'warning':
        context.log(`${correlationId} 🟡 STATUS: Warning - ${creditsRemaining} credits remaining (monitor usage)`);
        break;
      case 'critical':
        context.log(`${correlationId} 🔴 STATUS: Critical - ${creditsRemaining} credits remaining (review functions)`);
        break;
      case 'exhausted':
        context.log(`${correlationId} 🚨 STATUS: Exhausted - Service interruption imminent!`);
        break;
    }
    
    // Recommendations based on credit level
    if (processedStatus.status === 'critical' || processedStatus.status === 'exhausted') {
      context.log(`${correlationId} 💡 RECOMMENDATIONS:`);
      context.log(`${correlationId} - Review RefreshData function for excessive API calls`);
      context.log(`${correlationId} - Check for runaway functions or infinite loops`);
      context.log(`${correlationId} - Consider disabling non-essential functions temporarily`);
      context.log(`${correlationId} - Monitor GetCardInfo and GetCardsBySet usage patterns`);
    }
    
    context.log(`${correlationId} 📈 Next monitoring check in 6 hours`);
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    context.error(`${correlationId} ERROR in credit monitoring after ${totalTime}ms: ${errorMessage}`);
    
    // Try to log the error event even if main monitoring failed
    try {
      const creditMonitoringService = new CreditMonitoringService();
      await creditMonitoringService.logCreditEvent({
        timestamp: new Date(),
        eventType: 'error',
        creditsRemaining: -1, // Unknown due to error
        operation: 'credit-monitoring',
        functionName: 'MonitorCredits',
        correlationId,
        details: { error: errorMessage, duration: totalTime }
      });
    } catch (logError) {
      context.error(`${correlationId} Failed to log error event: ${logError}`);
    }
    
    throw error;
  }
}
