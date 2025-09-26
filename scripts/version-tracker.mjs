#!/usr/bin/env node

/**
 * Automated Dependency Version Tracker & Updater
 * Prevents recurring security vulnerabilities through proactive monitoring
 * Author: SichrPlace Security Team
 * Created: September 25, 2025
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class VersionTracker {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '..');
        this.trackerDbPath = path.join(this.projectRoot, '.version-tracker.json');
        this.packageJsonPath = path.join(this.projectRoot, 'package.json');
        
        // Known vulnerable packages and their secure versions
        this.secureVersionDatabase = {
            'tar-fs': {
                secure: '3.1.1',
                vulnerableRanges: ['>= 2.0.0, < 2.1.3'],
                lastChecked: null,
                alertHistory: []
            },
            'multer': {
                secure: '1.4.5-lts.1',
                vulnerableRanges: ['>= 2.0.0'],
                lastChecked: null,
                alertHistory: []
            },
            'next': {
                secure: '15.4.7',
                vulnerableRanges: ['>= 15.0.0, < 15.4.7'],
                lastChecked: null,
                alertHistory: []
            },
            'esbuild': {
                secure: '0.25.0',
                vulnerableRanges: ['< 0.25.0'],
                lastChecked: null,
                alertHistory: []
            },
            'http-proxy-middleware': {
                secure: '2.0.8',
                vulnerableRanges: ['< 2.0.8'],
                lastChecked: null,
                alertHistory: []
            },
            'tmp': {
                secure: '0.2.4',
                vulnerableRanges: ['< 0.2.4'],
                lastChecked: null,
                alertHistory: []
            },
            'on-headers': {
                secure: '1.1.0',
                vulnerableRanges: ['< 1.1.0'],
                lastChecked: null,
                alertHistory: []
            },
            'ipx': {
                secure: '2.1.1',
                vulnerableRanges: ['< 2.1.1'],
                lastChecked: null,
                alertHistory: []
            }
        };

        this.initializeTracker();
    }

    initializeTracker() {
        if (!fs.existsSync(this.trackerDbPath)) {
            const initialDb = {
                lastFullScan: null,
                trackedPackages: this.secureVersionDatabase,
                versionHistory: {},
                alertSuppressions: {},
                autoFixEnabled: true,
                scanSchedule: {
                    daily: true,
                    beforeBuild: true,
                    beforeDeploy: true
                }
            };
            fs.writeFileSync(this.trackerDbPath, JSON.stringify(initialDb, null, 2));
        }
    }

    loadTrackerDb() {
        return JSON.parse(fs.readFileSync(this.trackerDbPath, 'utf8'));
    }

    saveTrackerDb(db) {
        fs.writeFileSync(this.trackerDbPath, JSON.stringify(db, null, 2));
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${level}: ${message}`);
    }

    /**
     * Check if a version is vulnerable based on semver ranges
     */
    isVersionVulnerable(version, vulnerableRanges) {
        // Simplified version checking - in production, use semver library
        for (const range of vulnerableRanges) {
            if (range.includes('>=') && range.includes('<')) {
                // Handle range like ">= 2.0.0, < 2.1.3"
                const parts = range.split(',').map(p => p.trim());
                const minMatch = parts[0].match(/>= ([\d.]+)/);
                const maxMatch = parts[1].match(/< ([\d.]+)/);
                
                if (minMatch && maxMatch) {
                    const minVer = minMatch[1];
                    const maxVer = maxMatch[1];
                    
                    if (this.compareVersions(version, minVer) >= 0 && 
                        this.compareVersions(version, maxVer) < 0) {
                        return true;
                    }
                }
            } else if (range.includes('<')) {
                const match = range.match(/< ([\d.]+)/);
                if (match && this.compareVersions(version, match[1]) < 0) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Simple version comparison (returns -1, 0, or 1)
     */
    compareVersions(version1, version2) {
        const v1parts = version1.replace(/[^\d.]/g, '').split('.').map(Number);
        const v2parts = version2.replace(/[^\d.]/g, '').split('.').map(Number);
        
        for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
            const v1part = v1parts[i] || 0;
            const v2part = v2parts[i] || 0;
            
            if (v1part < v2part) return -1;
            if (v1part > v2part) return 1;
        }
        return 0;
    }

    /**
     * Get current installed versions
     */
    getCurrentVersions() {
        const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
        const installedVersions = {};

        // Get versions from dependencies and devDependencies
        const allDeps = {
            ...packageJson.dependencies || {},
            ...packageJson.devDependencies || {},
            ...packageJson.overrides || {}
        };

        // Also get actual installed versions
        try {
            const lsOutput = execSync('npm ls --json --depth=0', { encoding: 'utf8' });
            const lsData = JSON.parse(lsOutput);
            
            Object.keys(allDeps).forEach(packageName => {
                if (lsData.dependencies && lsData.dependencies[packageName]) {
                    installedVersions[packageName] = lsData.dependencies[packageName].version;
                }
            });
        } catch (error) {
            this.log(`Warning: Could not get installed versions: ${error.message}`, 'WARN');
        }

        return installedVersions;
    }

    /**
     * Check for version mismatches and vulnerabilities
     */
    analyzeVersions() {
        const db = this.loadTrackerDb();
        const currentVersions = this.getCurrentVersions();
        const issues = {
            vulnerabilities: [],
            mismatches: [],
            recommendations: []
        };

        Object.keys(db.trackedPackages).forEach(packageName => {
            const tracked = db.trackedPackages[packageName];
            const currentVersion = currentVersions[packageName];

            if (!currentVersion) {
                // Package not installed - might be a subdependency
                this.log(`${packageName} not found in direct dependencies`, 'INFO');
                return;
            }

            // Check if current version is vulnerable
            if (this.isVersionVulnerable(currentVersion, tracked.vulnerableRanges)) {
                issues.vulnerabilities.push({
                    package: packageName,
                    currentVersion,
                    secureVersion: tracked.secure,
                    severity: 'HIGH',
                    action: 'UPDATE_REQUIRED'
                });
            }

            // Check if current version matches our secure version
            if (this.compareVersions(currentVersion, tracked.secure) !== 0) {
                issues.mismatches.push({
                    package: packageName,
                    currentVersion,
                    recommendedVersion: tracked.secure,
                    severity: 'MEDIUM',
                    action: 'UPDATE_RECOMMENDED'
                });
            }

            // Update last checked timestamp
            tracked.lastChecked = new Date().toISOString();
        });

        // Save updated database
        db.lastFullScan = new Date().toISOString();
        this.saveTrackerDb(db);

        return issues;
    }

    /**
     * Apply automatic fixes
     */
    applyFixes(issues) {
        const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
        let modified = false;

        // Fix vulnerabilities first
        issues.vulnerabilities.forEach(issue => {
            this.log(`Fixing vulnerability in ${issue.package}: ${issue.currentVersion} → ${issue.secureVersion}`);
            
            if (packageJson.dependencies && packageJson.dependencies[issue.package]) {
                packageJson.dependencies[issue.package] = issue.secureVersion;
                modified = true;
            } else if (packageJson.devDependencies && packageJson.devDependencies[issue.package]) {
                packageJson.devDependencies[issue.package] = issue.secureVersion;
                modified = true;
            } else {
                // Add to overrides for subdependencies
                if (!packageJson.overrides) packageJson.overrides = {};
                packageJson.overrides[issue.package] = issue.secureVersion;
                modified = true;
            }
        });

        // Apply version mismatches
        issues.mismatches.forEach(issue => {
            this.log(`Updating ${issue.package}: ${issue.currentVersion} → ${issue.recommendedVersion}`);
            
            if (packageJson.dependencies && packageJson.dependencies[issue.package]) {
                packageJson.dependencies[issue.package] = issue.recommendedVersion;
                modified = true;
            } else if (packageJson.devDependencies && packageJson.devDependencies[issue.package]) {
                packageJson.devDependencies[issue.package] = issue.recommendedVersion;
                modified = true;
            } else {
                // Add to overrides for subdependencies
                if (!packageJson.overrides) packageJson.overrides = {};
                packageJson.overrides[issue.package] = issue.recommendedVersion;
                modified = true;
            }
        });

        if (modified) {
            // Save updated package.json
            fs.writeFileSync(this.packageJsonPath, JSON.stringify(packageJson, null, 2));
            this.log('package.json updated with security fixes');

            // Run npm install
            try {
                this.log('Installing updated dependencies...');
                execSync('npm install', { stdio: 'inherit' });
                this.log('Dependencies updated successfully');
                return true;
            } catch (error) {
                this.log(`npm install failed: ${error.message}`, 'ERROR');
                return false;
            }
        }

        return false;
    }

    /**
     * Generate prevention report
     */
    generatePreventionReport(issues) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                vulnerabilities: issues.vulnerabilities.length,
                mismatches: issues.mismatches.length,
                totalIssues: issues.vulnerabilities.length + issues.mismatches.length
            },
            details: issues,
            preventionMeasures: {
                automatedScanning: true,
                versionPinning: true,
                overrideManagement: true,
                githubIntegration: true
            },
            nextActions: []
        };

        // Add next actions based on findings
        if (issues.vulnerabilities.length > 0) {
            report.nextActions.push('Run automated fixes with --fix flag');
        }
        if (issues.mismatches.length > 0) {
            report.nextActions.push('Review version mismatches for compatibility');
        }
        if (issues.vulnerabilities.length === 0 && issues.mismatches.length === 0) {
            report.nextActions.push('All versions are secure and up-to-date');
        }

        const reportPath = path.join(this.projectRoot, `version-tracking-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        return report;
    }

    /**
     * Main execution
     */
    run(options = {}) {
        this.log('Starting automated version tracking...');

        try {
            const issues = this.analyzeVersions();
            
            this.log(`Found ${issues.vulnerabilities.length} vulnerabilities`);
            this.log(`Found ${issues.mismatches.length} version mismatches`);

            if (options.fix && (issues.vulnerabilities.length > 0 || issues.mismatches.length > 0)) {
                const success = this.applyFixes(issues);
                if (success) {
                    this.log('All fixes applied successfully');
                } else {
                    this.log('Some fixes failed - manual intervention required', 'ERROR');
                }
            }

            const report = this.generatePreventionReport(issues);
            return report;

        } catch (error) {
            this.log(`Version tracking failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const tracker = new VersionTracker();
    const autoFix = process.argv.includes('--fix');
    
    tracker.run({ fix: autoFix })
        .then(report => {
            console.log('\n=== VERSION TRACKING COMPLETE ===');
            console.log(`Vulnerabilities: ${report.summary.vulnerabilities}`);
            console.log(`Mismatches: ${report.summary.mismatches}`);
            console.log(`Total issues: ${report.summary.totalIssues}`);
            
            if (report.summary.totalIssues > 0) {
                console.log('\nNext actions:');
                report.nextActions.forEach(action => console.log(`  - ${action}`));
                
                if (!autoFix) {
                    console.log('\nTo apply fixes automatically, run:');
                    console.log('node scripts/version-tracker.mjs --fix');
                }
            } else {
                console.log('\n✅ All versions are secure and properly tracked!');
            }
        })
        .catch(error => {
            console.error('Version tracking failed:', error.message);
            process.exit(1);
        });
}

export default VersionTracker;