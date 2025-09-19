# 🗄️ Critical Database Backup & Recovery Strategy

## 🚨 **CRITICAL REQUIREMENT: Data Loss Prevention**

### **📋 Current Risk Assessment**
- ❌ **NO BACKUP SYSTEM**: Complete data loss risk
- ❌ **NO RECOVERY PLAN**: Business continuity at risk  
- ❌ **NO MONITORING**: Silent failures possible
- 🎯 **BUSINESS IMPACT**: Complete platform failure if data lost

## 🛡️ **Comprehensive Backup Strategy**

### **🔄 Multi-Tier Backup System**

#### **Tier 1: Real-Time Replication (Supabase Built-in)**
```bash
✅ Supabase Features:
- Point-in-time recovery (PITR)
- Automated daily backups
- Cross-region replication
- 99.9% uptime SLA

Configuration:
- Retention: 7 days (free plan)
- Frequency: Continuous WAL streaming
- Recovery: Down to specific timestamp
```

#### **Tier 2: Daily Automated Backups**
```javascript
// backend/scripts/daily-backup.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

class DatabaseBackup {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.backupDir = path.join(__dirname, '../backups');
    this.ensureBackupDirectory();
  }

  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async createFullBackup() {
    const timestamp = new Date().toISOString().split('T')[0];
    const backupFile = path.join(this.backupDir, \`full-backup-\${timestamp}.json\`);

    console.log('🗄️ Starting full database backup...');

    try {
      const backup = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: {}
      };

      // Backup all critical tables
      const tables = [
        'apartments',
        'users', 
        'user_favorites',
        'viewing_requests',
        'conversations',
        'messages',
        'payments',
        'analytics_events',
        'gdpr_requests'
      ];

      for (const table of tables) {
        console.log(\`📋 Backing up table: \${table}\`);
        const { data, error } = await this.supabase
          .from(table)
          .select('*');

        if (error) {
          console.error(\`❌ Error backing up \${table}:`, error);
          throw error;
        }

        backup.data[table] = data;
        console.log(\`✅ \${table}: \${data.length} records backed up\`);
      }

      // Save backup to file
      fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
      
      // Compress backup
      await this.compressBackup(backupFile);

      console.log(\`✅ Full backup completed: \${backupFile}\`);
      return backupFile;

    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw error;
    }
  }

  async compressBackup(backupFile) {
    const zlib = require('zlib');
    const fs = require('fs');

    const input = fs.createReadStream(backupFile);
    const output = fs.createWriteStream(\`\${backupFile}.gz\`);
    const gzip = zlib.createGzip();

    input.pipe(gzip).pipe(output);

    return new Promise((resolve, reject) => {
      output.on('finish', () => {
        fs.unlinkSync(backupFile); // Delete uncompressed file
        console.log(\`🗜️ Backup compressed: \${backupFile}.gz\`);
        resolve();
      });
      output.on('error', reject);
    });
  }

  async uploadToCloudStorage(backupFile) {
    // Option 1: AWS S3
    if (process.env.AWS_S3_BUCKET) {
      return this.uploadToS3(backupFile);
    }
    
    // Option 2: Google Cloud Storage
    if (process.env.GCS_BUCKET) {
      return this.uploadToGCS(backupFile);
    }

    // Option 3: Local storage with monitoring
    console.log('📁 Backup stored locally (configure cloud storage for production)');
  }

  async uploadToS3(backupFile) {
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });

    const fileContent = fs.readFileSync(backupFile);
    const fileName = path.basename(backupFile);

    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: \`sichrplace-backups/\${fileName}\`,
      Body: fileContent,
      ServerSideEncryption: 'AES256'
    };

    try {
      const result = await s3.upload(params).promise();
      console.log(\`☁️ Backup uploaded to S3: \${result.Location}\`);
      return result.Location;
    } catch (error) {
      console.error('❌ S3 upload failed:', error);
      throw error;
    }
  }

  async cleanupOldBackups() {
    const retentionDays = 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const files = fs.readdirSync(this.backupDir);
    const oldFiles = files.filter(file => {
      const filePath = path.join(this.backupDir, file);
      const stats = fs.statSync(filePath);
      return stats.mtime < cutoffDate;
    });

    oldFiles.forEach(file => {
      const filePath = path.join(this.backupDir, file);
      fs.unlinkSync(filePath);
      console.log(\`🗑️ Deleted old backup: \${file}\`);
    });

    console.log(\`🧹 Cleanup complete: removed \${oldFiles.length} old backups\`);
  }
}

module.exports = DatabaseBackup;
```

#### **Tier 3: Critical Data Real-time Sync**
```javascript
// backend/services/criticalDataSync.js
class CriticalDataSync {
  constructor() {
    this.criticalTables = ['users', 'apartments', 'payments'];
    this.syncInterval = 5 * 60 * 1000; // 5 minutes
    this.setupRealTimeSync();
  }

  setupRealTimeSync() {
    // Listen to critical table changes
    this.criticalTables.forEach(table => {
      this.supabase
        .channel(\`sync-\${table}\`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table },
          (payload) => this.handleCriticalChange(table, payload)
        )
        .subscribe();
    });
  }

  async handleCriticalChange(table, payload) {
    console.log(\`🔄 Critical change detected in \${table}\`);
    
    // Immediate backup of changed data
    const backup = {
      timestamp: new Date().toISOString(),
      table,
      operation: payload.eventType,
      data: payload.new || payload.old,
      changeId: \`\${table}-\${Date.now()}\`
    };

    // Store in separate critical changes log
    await this.storeCriticalChange(backup);
    
    // Optional: Send to external monitoring
    await this.notifyCriticalChange(backup);
  }

  async storeCriticalChange(change) {
    await this.supabase
      .from('critical_changes_log')
      .insert(change);
  }
}
```

## 🔄 **Automated Backup Scheduling**

### **Cron Job Setup (Linux/Mac)**
```bash
# backup-cron.sh
#!/bin/bash

# Add to crontab: crontab -e
# Daily backup at 2 AM: 0 2 * * * /path/to/backup-cron.sh
# Weekly full backup: 0 2 * * 0 /path/to/backup-cron.sh --full

cd /path/to/sichrplace/backend

# Set environment variables
export NODE_ENV=production
export SUPABASE_URL=$SUPABASE_URL
export SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# Run backup
node scripts/daily-backup.js

# Upload to cloud storage
if [ "$1" = "--full" ]; then
    echo "📦 Running full backup with cloud upload..."
    node scripts/cloud-backup.js
fi

# Send notification
curl -X POST "https://api.sichrplace.com/api/admin/backup-notification" \
     -H "Content-Type: application/json" \
     -d '{"status":"completed","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
```

### **Node.js Scheduler (Alternative)**
```javascript
// backend/scheduler/backupScheduler.js
const cron = require('node-cron');
const DatabaseBackup = require('../scripts/daily-backup');
const EmailService = require('../services/emailService');

class BackupScheduler {
  constructor() {
    this.backup = new DatabaseBackup();
    this.setupSchedules();
  }

  setupSchedules() {
    // Daily backup at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('🕐 Starting scheduled daily backup...');
      await this.runDailyBackup();
    });

    // Weekly full backup on Sunday at 1 AM
    cron.schedule('0 1 * * 0', async () => {
      console.log('🕐 Starting scheduled weekly backup...');
      await this.runWeeklyBackup();
    });

    // Monthly cleanup on 1st at 3 AM
    cron.schedule('0 3 1 * *', async () => {
      console.log('🕐 Starting scheduled cleanup...');
      await this.runCleanup();
    });
  }

  async runDailyBackup() {
    try {
      const backupFile = await this.backup.createFullBackup();
      await this.backup.uploadToCloudStorage(backupFile);
      
      await this.sendBackupNotification('success', 'Daily backup completed');
      console.log('✅ Daily backup completed successfully');
    } catch (error) {
      await this.sendBackupNotification('error', error.message);
      console.error('❌ Daily backup failed:', error);
    }
  }

  async runWeeklyBackup() {
    try {
      const backupFile = await this.backup.createFullBackup();
      await this.backup.uploadToCloudStorage(backupFile);
      
      // Additional verification for weekly backup
      await this.verifyBackupIntegrity(backupFile);
      
      await this.sendBackupNotification('success', 'Weekly backup completed');
      console.log('✅ Weekly backup completed successfully');
    } catch (error) {
      await this.sendBackupNotification('error', error.message);
      console.error('❌ Weekly backup failed:', error);
    }
  }

  async verifyBackupIntegrity(backupFile) {
    const fs = require('fs');
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    
    // Verify backup structure
    const requiredTables = ['apartments', 'users', 'viewing_requests'];
    const missingTables = requiredTables.filter(table => !backup.data[table]);
    
    if (missingTables.length > 0) {
      throw new Error(\`Backup missing tables: \${missingTables.join(', ')}\`);
    }

    // Verify data counts
    let totalRecords = 0;
    Object.entries(backup.data).forEach(([table, data]) => {
      totalRecords += data.length;
      console.log(\`📊 \${table}: \${data.length} records\`);
    });

    console.log(\`✅ Backup integrity verified: \${totalRecords} total records\`);
  }

  async sendBackupNotification(status, message) {
    const subject = status === 'success' 
      ? '✅ SichrPlace Backup Successful' 
      : '❌ SichrPlace Backup Failed';

    const html = \`
      <h2>Database Backup \${status === 'success' ? 'Completed' : 'Failed'}</h2>
      <p><strong>Time:</strong> \${new Date().toISOString()}</p>
      <p><strong>Status:</strong> \${status.toUpperCase()}</p>
      <p><strong>Message:</strong> \${message}</p>
      \${status === 'error' ? '<p style="color:red;"><strong>Action Required:</strong> Please check backup system immediately.</p>' : ''}
    \`;

    await EmailService.sendEmail(
      process.env.ADMIN_EMAIL,
      subject,
      html
    );
  }
}

module.exports = BackupScheduler;
```

## 🚀 **Disaster Recovery Procedures**

### **Recovery Scenarios & Solutions**

#### **Scenario 1: Complete Database Loss**
```javascript
// backend/scripts/disaster-recovery.js
class DisasterRecovery {
  async restoreFromBackup(backupFile, options = {}) {
    console.log('🚨 DISASTER RECOVERY: Starting database restore...');
    
    const {
      targetDate = null,
      tables = 'all',
      dryRun = false
    } = options;

    try {
      // 1. Verify backup integrity
      const backup = await this.loadAndVerifyBackup(backupFile);
      
      // 2. Create new Supabase instance (if needed)
      if (options.newInstance) {
        await this.createNewSupabaseInstance();
      }

      // 3. Restore data
      const restoreResults = await this.restoreData(backup, { tables, dryRun });
      
      // 4. Verify restoration
      const verification = await this.verifyRestoration(backup);
      
      console.log('✅ DISASTER RECOVERY COMPLETE');
      return { backup, restoreResults, verification };

    } catch (error) {
      console.error('❌ DISASTER RECOVERY FAILED:', error);
      throw error;
    }
  }

  async restoreData(backup, options) {
    const { tables, dryRun } = options;
    const tablesToRestore = tables === 'all' 
      ? Object.keys(backup.data)
      : Array.isArray(tables) ? tables : [tables];

    const results = {};

    for (const table of tablesToRestore) {
      console.log(\`🔄 Restoring table: \${table}\`);
      
      if (dryRun) {
        console.log(\`🧪 DRY RUN: Would restore \${backup.data[table].length} records to \${table}\`);
        results[table] = { dryRun: true, recordCount: backup.data[table].length };
        continue;
      }

      // Clear existing data (if full restore)
      if (options.fullRestore) {
        await this.supabase.from(table).delete().neq('id', 0);
      }

      // Insert backup data in batches
      const batchSize = 100;
      const data = backup.data[table];
      
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const { error } = await this.supabase
          .from(table)
          .insert(batch);

        if (error) {
          console.error(\`❌ Error restoring batch for \${table}:`, error);
          throw error;
        }
      }

      results[table] = { 
        restored: true, 
        recordCount: data.length 
      };
      
      console.log(\`✅ \${table}: \${data.length} records restored\`);
    }

    return results;
  }
}

// Usage examples:
// node scripts/disaster-recovery.js --backup=backup-2024-01-15.json --dry-run
// node scripts/disaster-recovery.js --backup=latest --tables=users,apartments
// node scripts/disaster-recovery.js --backup=latest --full-restore
```

#### **Scenario 2: Partial Data Corruption**
```javascript
// backend/scripts/partial-recovery.js
class PartialRecovery {
  async recoverCorruptedTable(tableName, corruptionDate) {
    console.log(\`🔧 Recovering corrupted table: \${tableName}\`);
    
    // 1. Find backup before corruption
    const cleanBackup = await this.findCleanBackup(corruptionDate);
    
    // 2. Compare current vs backup data
    const differences = await this.compareTableData(tableName, cleanBackup);
    
    // 3. Restore only corrupted records
    const restored = await this.restoreCorruptedRecords(tableName, differences);
    
    console.log(\`✅ Partial recovery complete: \${restored.length} records fixed\`);
    return restored;
  }

  async findCleanBackup(corruptionDate) {
    const backupDir = path.join(__dirname, '../backups');
    const files = fs.readdirSync(backupDir)
      .filter(file => file.includes('backup') && file.endsWith('.json'))
      .map(file => ({
        file,
        date: new Date(file.match(/backup-(\d{4}-\d{2}-\d{2})/)[1])
      }))
      .filter(backup => backup.date < corruptionDate)
      .sort((a, b) => b.date - a.date);

    if (files.length === 0) {
      throw new Error('No clean backup found before corruption date');
    }

    return files[0].file;
  }
}
```

## 📊 **Backup Monitoring & Alerts**

### **Health Check Dashboard**
```javascript
// backend/api/admin/backup-status.js
app.get('/api/admin/backup-status', async (req, res) => {
  try {
    const status = {
      lastBackup: await getLastBackupInfo(),
      backupHealth: await checkBackupHealth(),
      storageUsage: await getStorageUsage(),
      upcomingBackups: await getUpcomingBackups(),
      recoverySLA: {
        rto: '4 hours', // Recovery Time Objective
        rpo: '1 hour'   // Recovery Point Objective
      }
    };

    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

async function checkBackupHealth() {
  const lastBackup = await getLastBackupInfo();
  const now = new Date();
  const hoursSinceLastBackup = (now - lastBackup.timestamp) / (1000 * 60 * 60);

  return {
    status: hoursSinceLastBackup < 25 ? 'healthy' : 'warning',
    lastBackupAge: \`\${Math.round(hoursSinceLastBackup)} hours ago\`,
    nextBackupIn: \`\${24 - Math.round(hoursSinceLastBackup)} hours\`,
    backupSize: lastBackup.size,
    recordCount: lastBackup.recordCount
  };
}
```

### **Automated Monitoring**
```javascript
// backend/monitoring/backupMonitoring.js
class BackupMonitoring {
  constructor() {
    this.checks = [
      this.checkBackupFrequency,
      this.checkBackupSize,
      this.checkStorageSpace,
      this.checkBackupIntegrity
    ];
  }

  async runHealthChecks() {
    const results = [];
    
    for (const check of this.checks) {
      try {
        const result = await check.call(this);
        results.push(result);
      } catch (error) {
        results.push({
          check: check.name,
          status: 'error',
          message: error.message
        });
      }
    }

    const failures = results.filter(r => r.status === 'error' || r.status === 'warning');
    
    if (failures.length > 0) {
      await this.sendAlert(failures);
    }

    return results;
  }

  async sendAlert(failures) {
    const subject = '🚨 SichrPlace Backup System Alert';
    const html = \`
      <h2>Backup System Issues Detected</h2>
      <ul>
        \${failures.map(f => \`<li><strong>\${f.check}:</strong> \${f.message}</li>\`).join('')}
      </ul>
      <p>Please investigate and resolve these issues immediately.</p>
    \`;

    await EmailService.sendEmail(process.env.ADMIN_EMAIL, subject, html);
  }
}
```

## 💰 **Backup Storage Costs & Options**

### **Cost-Effective Storage Solutions**

| **Option** | **Free Tier** | **Cost per GB/month** | **Retention** |
|------------|---------------|----------------------|---------------|
| **AWS S3** | 5GB | $0.023 | Unlimited |
| **Google Cloud** | 5GB | $0.020 | Unlimited |
| **Supabase Built-in** | 7 days | Included | 7-30 days |
| **Local + Cloud Sync** | Varies | $0.010 | Custom |

### **Recommended Setup (Cost: ~$5/month)**
```bash
Daily Backups: Local storage (free)
Weekly Backups: AWS S3 (estimated 1GB = $0.023/month)
Monthly Archives: AWS S3 Glacier ($0.004/GB/month)
Real-time Sync: Supabase PITR (included)

Total Monthly Cost: < $5
```

## ✅ **Implementation Timeline**

| **Phase** | **Duration** | **Priority** |
|-----------|--------------|-------------|
| **Backup Scripts** | 2 hours | CRITICAL |
| **Automation Setup** | 1 hour | CRITICAL |
| **Cloud Storage Config** | 1 hour | HIGH |
| **Monitoring & Alerts** | 1 hour | HIGH |
| **Recovery Testing** | 2 hours | MEDIUM |
| **Documentation** | 1 hour | MEDIUM |

**Total Implementation: 8 hours over 2 days**

## 🎯 **Success Metrics**

### **Backup Performance Targets**
- ✅ **Daily backup success rate**: > 99%
- ✅ **Backup completion time**: < 30 minutes
- ✅ **Recovery time objective (RTO)**: < 4 hours
- ✅ **Recovery point objective (RPO)**: < 1 hour
- ✅ **Storage efficiency**: > 80% compression
- ✅ **Alert response time**: < 15 minutes

### **Business Continuity Assurance**
- ✅ **Zero data loss tolerance** for critical transactions
- ✅ **Maximum 4-hour downtime** for complete recovery
- ✅ **Automated monitoring** prevents silent failures
- ✅ **Multiple recovery options** for different scenarios

**🛡️ Goal: Complete data protection and business continuity within 2 days**