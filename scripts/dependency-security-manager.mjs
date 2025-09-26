#!/usr/bin/env node

/**
 * SichrPlace Dependency Security Manager
 * Comprehensive system to prevent recurring security vulnerabilities
 * Author: SichrPlace Security Team
 * Created: September 25, 2025
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DependencySecurityManager {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '..');
        this.packageJsonPath = path.join(this.projectRoot, 'package.json');
        this.securityLogPath = path.join(this.projectRoot, 'security-audit.log');
        this.vulnerabilityDbPath = path.join(this.projectRoot, '.dependency-security.json');
        
        // Initialize tracking database
        this.initializeSecurityDb();
    }

    /**
     * Initialize security tracking database
     */
    initializeSecurityDb() {
        if (!fs.existsSync(this.vulnerabilityDbPath)) {
            const initialDb = {
                lastAudit: null,
                vulnerabilities: {},
                secureVersions: {},
                overrides: {},
                ignoredAlerts: [],
                auditHistory: []
            };
            fs.writeFileSync(this.vulnerabilityDbPath, JSON.stringify(initialDb, null, 2));
        }
    }

    /**
     * Load security database
     */
    loadSecurityDb() {
        return JSON.parse(fs.readFileSync(this.vulnerabilityDbPath, 'utf8'));
    }

    /**
     * Save security database
     */
    saveSecurityDb(db) {
        fs.writeFileSync(this.vulnerabilityDbPath, JSON.stringify(db, null, 2));
    }

    /**
     * Log security actions
     */
    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${level}: ${message}\n`;
        fs.appendFileSync(this.securityLogPath, logEntry);
        console.log(`${level}: ${message}`);
    }

    /**
     * Get all GitHub Dependabot alerts
     */
    async getGitHubAlerts() {
        try {
            const alertsJson = execSync('gh api repos/omer3kale/sichrplace/dependabot/alerts', 
                { encoding: 'utf8' });
            return JSON.parse(alertsJson);
        } catch (error) {
            this.log(`Failed to fetch GitHub alerts: ${error.message}`, 'ERROR');
            return [];
        }
    }

    /**
     * Get npm audit results
     */
    getNpmAudit() {
        try {
            const auditJson = execSync('npm audit --json', { encoding: 'utf8' });
            return JSON.parse(auditJson);
        } catch (error) {
            // npm audit returns non-zero exit code when vulnerabilities exist
            if (error.stdout) {
                try {
                    return JSON.parse(error.stdout);
                } catch (parseError) {
                    this.log(`Failed to parse npm audit: ${parseError.message}`, 'ERROR');
                    return null;
                }
            }
            return null;
        }
    }

    /**
     * Get detailed dependency tree
     */
    getDependencyTree() {
        try {
            const treeJson = execSync('npm ls --json --all', { encoding: 'utf8' });
            return JSON.parse(treeJson);
        } catch (error) {
            if (error.stdout) {
                try {
                    return JSON.parse(error.stdout);
                } catch (parseError) {
                    this.log(`Failed to parse dependency tree: ${parseError.message}`, 'ERROR');
                    return null;
                }
            }
            return null;
        }
    }

    /**
     * Find all instances of a package in dependency tree
     */
    findPackageInstances(tree, packageName, instances = [], path = []) {
        if (!tree || !tree.dependencies) return instances;

        Object.keys(tree.dependencies).forEach(depName => {
            const dep = tree.dependencies[depName];
            const currentPath = [...path, depName];

            if (depName === packageName) {
                instances.push({
                    name: depName,
                    version: dep.version,
                    path: currentPath,
                    resolved: dep.resolved,
                    overridden: dep.overridden || false,
                    dev: dep.dev || false
                });
            }

            if (dep.dependencies) {
                this.findPackageInstances(dep, packageName, instances, currentPath);
            }
        });

        return instances;
    }

    /**
     * Analyze vulnerability patterns
     */
    analyzeVulnerabilityPatterns(alerts) {
        const patterns = {
            highRiskPackages: {},
            vulnerabilityTypes: {},
            severityDistribution: { low: 0, medium: 0, high: 0, critical: 0 }
        };

        alerts.forEach(alert => {
            const packageName = alert.dependency.package.name;
            const severity = alert.security_vulnerability.severity;

            // Track high-risk packages
            if (!patterns.highRiskPackages[packageName]) {
                patterns.highRiskPackages[packageName] = 0;
            }
            patterns.highRiskPackages[packageName]++;

            // Track severity distribution
            patterns.severityDistribution[severity]++;

            // Track vulnerability types (from CVE descriptions)
            const description = alert.security_advisory.description.toLowerCase();
            if (description.includes('dos') || description.includes('denial of service')) {
                patterns.vulnerabilityTypes.dos = (patterns.vulnerabilityTypes.dos || 0) + 1;
            }
            if (description.includes('path traversal') || description.includes('directory traversal')) {
                patterns.vulnerabilityTypes.pathTraversal = (patterns.vulnerabilityTypes.pathTraversal || 0) + 1;
            }
            if (description.includes('ssrf') || description.includes('server-side request forgery')) {
                patterns.vulnerabilityTypes.ssrf = (patterns.vulnerabilityTypes.ssrf || 0) + 1;
            }
            if (description.includes('prototype pollution')) {
                patterns.vulnerabilityTypes.prototypePollution = (patterns.vulnerabilityTypes.prototypePollution || 0) + 1;
            }
        });

        return patterns;
    }

    /**
     * Generate security recommendations
     */
    generateRecommendations(alerts, patterns) {
        const recommendations = {
            immediate: [],
            preventive: [],
            monitoring: []
        };

        // Immediate actions for critical/high severity
        alerts.filter(alert => 
            ['critical', 'high'].includes(alert.security_vulnerability.severity) && 
            alert.state === 'open'
        ).forEach(alert => {
            const packageName = alert.dependency.package.name;
            const patchedVersion = alert.security_vulnerability.first_patched_version?.identifier;
            
            recommendations.immediate.push({
                action: 'UPDATE_PACKAGE',
                package: packageName,
                currentRange: alert.security_vulnerability.vulnerable_version_range,
                targetVersion: patchedVersion,
                alertNumber: alert.number,
                severity: alert.security_vulnerability.severity
            });
        });

        // Preventive measures for frequently vulnerable packages
        Object.entries(patterns.highRiskPackages)
            .filter(([_, count]) => count > 1)
            .forEach(([packageName, count]) => {
                recommendations.preventive.push({
                    action: 'MONITOR_PACKAGE',
                    package: packageName,
                    reason: `Has had ${count} vulnerabilities`,
                    suggestion: 'Consider alternative package or pin to secure version'
                });
            });

        return recommendations;
    }

    /**
     * Apply security fixes
     */
    async applySecurityFixes(recommendations) {
        const db = this.loadSecurityDb();
        const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));

        for (const rec of recommendations.immediate) {
            if (rec.action === 'UPDATE_PACKAGE') {
                try {
                    this.log(`Applying fix for ${rec.package} (Alert #${rec.alertNumber})`);
                    
                    // Add to overrides if not direct dependency
                    if (!packageJson.dependencies[rec.package] && !packageJson.devDependencies[rec.package]) {
                        if (!packageJson.overrides) packageJson.overrides = {};
                        packageJson.overrides[rec.package] = rec.targetVersion || 'latest';
                        this.log(`Added override for ${rec.package}: ${rec.targetVersion || 'latest'}`);
                    } else {
                        // Update direct dependency
                        if (packageJson.dependencies[rec.package]) {
                            packageJson.dependencies[rec.package] = rec.targetVersion || 'latest';
                        }
                        if (packageJson.devDependencies[rec.package]) {
                            packageJson.devDependencies[rec.package] = rec.targetVersion || 'latest';
                        }
                        this.log(`Updated direct dependency ${rec.package}: ${rec.targetVersion || 'latest'}`);
                    }

                    // Track in security database
                    db.secureVersions[rec.package] = {
                        version: rec.targetVersion || 'latest',
                        fixedAlert: rec.alertNumber,
                        fixedAt: new Date().toISOString(),
                        severity: rec.severity
                    };

                } catch (error) {
                    this.log(`Failed to fix ${rec.package}: ${error.message}`, 'ERROR');
                }
            }
        }

        // Save updated package.json
        fs.writeFileSync(this.packageJsonPath, JSON.stringify(packageJson, null, 2));
        
        // Update security database
        db.lastAudit = new Date().toISOString();
        this.saveSecurityDb(db);

        // Run npm install to apply changes
        try {
            this.log('Running npm install to apply security fixes...');
            execSync('npm install', { stdio: 'inherit' });
            this.log('Security fixes applied successfully');
        } catch (error) {
            this.log(`npm install failed: ${error.message}`, 'ERROR');
        }
    }

    /**
     * Verify fixes were applied
     */
    async verifyFixes() {
        this.log('Verifying security fixes...');
        
        const newAlerts = await this.getGitHubAlerts();
        const openAlerts = newAlerts.filter(alert => alert.state === 'open');
        
        this.log(`Verification complete: ${openAlerts.length} open alerts remaining`);
        
        if (openAlerts.length > 0) {
            this.log('Remaining open alerts:', 'WARN');
            openAlerts.forEach(alert => {
                this.log(`  - Alert #${alert.number}: ${alert.dependency.package.name} (${alert.security_vulnerability.severity})`, 'WARN');
            });
        }
        
        return openAlerts;
    }

    /**
     * Generate security report
     */
    generateSecurityReport(alerts, patterns, recommendations) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalAlerts: alerts.length,
                openAlerts: alerts.filter(a => a.state === 'open').length,
                criticalHigh: alerts.filter(a => ['critical', 'high'].includes(a.security_vulnerability.severity)).length
            },
            patterns,
            recommendations,
            nextAuditDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
        };

        const reportPath = path.join(this.projectRoot, `security-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        this.log(`Security report generated: ${reportPath}`);
        return report;
    }

    /**
     * Main execution method
     */
    async run(options = {}) {
        this.log('Starting comprehensive security audit...');

        try {
            // 1. Gather all security data
            const alerts = await this.getGitHubAlerts();
            const npmAudit = this.getNpmAudit();
            const dependencyTree = this.getDependencyTree();

            this.log(`Found ${alerts.length} total GitHub alerts`);
            this.log(`Found ${alerts.filter(a => a.state === 'open').length} open GitHub alerts`);

            // 2. Analyze vulnerability patterns
            const patterns = this.analyzeVulnerabilityPatterns(alerts);
            this.log(`Identified ${Object.keys(patterns.highRiskPackages).length} high-risk packages`);

            // 3. Generate recommendations
            const recommendations = this.generateRecommendations(alerts, patterns);
            this.log(`Generated ${recommendations.immediate.length} immediate fixes`);

            // 4. Apply fixes if requested
            if (options.autoFix) {
                await this.applySecurityFixes(recommendations);
                
                // Wait a moment for GitHub to update
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // Verify fixes
                await this.verifyFixes();
            }

            // 5. Generate comprehensive report
            const report = this.generateSecurityReport(alerts, patterns, recommendations);
            
            return report;

        } catch (error) {
            this.log(`Security audit failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const manager = new DependencySecurityManager();
    const autoFix = process.argv.includes('--fix');
    
    manager.run({ autoFix })
        .then(report => {
            console.log('\n=== SECURITY AUDIT COMPLETE ===');
            console.log(`Total alerts: ${report.summary.totalAlerts}`);
            console.log(`Open alerts: ${report.summary.openAlerts}`);
            console.log(`Critical/High: ${report.summary.criticalHigh}`);
            console.log(`Next audit: ${report.nextAuditDate}`);
            
            if (report.summary.openAlerts > 0) {
                console.log('\nTo apply fixes automatically, run:');
                console.log('node scripts/dependency-security-manager.mjs --fix');
                process.exit(1);
            } else {
                console.log('\n✅ All security vulnerabilities resolved!');
                process.exit(0);
            }
        })
        .catch(error => {
            console.error('Security audit failed:', error.message);
            process.exit(1);
        });
}

export default DependencySecurityManager;