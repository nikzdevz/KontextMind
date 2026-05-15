/**
 * Health Module
 *
 * Codebase health monitoring and metrics.
 */

export {
  CodebaseHealthMonitor,
  getCodebaseHealthMonitor,
  type HealthMetric,
  type HealthReport,
  type HealthIssue,
  type ComponentHealth,
  type HealthThresholds,
  type MonitoringConfig,
} from './codebase-health-monitor.js';

export { HEALTH_DIR } from './codebase-health-monitor.js';