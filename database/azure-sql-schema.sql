-- Lantern Roster — Azure SQL (SQL Server) schema.
-- Generated from backend/prisma/schema.prisma by `npm run sql:azure`. Do not edit by hand.

BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Site] (
    [id] NVARCHAR(64) NOT NULL,
    [code] NVARCHAR(255) NOT NULL,
    [name] NVARCHAR(255) NOT NULL,
    [entityName] NVARCHAR(255),
    [siteType] NVARCHAR(255) NOT NULL CONSTRAINT [Site_siteType_df] DEFAULT 'supportive',
    [address] NVARCHAR(max),
    [active] BIT NOT NULL CONSTRAINT [Site_active_df] DEFAULT 1,
    [attentionHours] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Site_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Site_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Site_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[Tenant] (
    [id] NVARCHAR(64) NOT NULL,
    [siteId] NVARCHAR(64) NOT NULL,
    [unit] NVARCHAR(255),
    [firstName] NVARCHAR(255) NOT NULL,
    [lastName] NVARCHAR(255) NOT NULL CONSTRAINT [Tenant_lastName_df] DEFAULT '',
    [preferredName] NVARCHAR(255),
    [status] NVARCHAR(255) NOT NULL CONSTRAINT [Tenant_status_df] DEFAULT 'active',
    [moveInDate] DATETIME2,
    [moveOutDate] DATETIME2,
    [notes] NVARCHAR(max),
    [externalId] NVARCHAR(64),
    [lastActivityAt] DATETIME2,
    [lastActivitySource] NVARCHAR(255),
    [lastKeptAt] DATETIME2,
    [lastKeptById] NVARCHAR(64),
    [attentionClockAt] DATETIME2 NOT NULL CONSTRAINT [Tenant_attentionClockAt_df] DEFAULT CURRENT_TIMESTAMP,
    [archivedAt] DATETIME2,
    [archivedById] NVARCHAR(64),
    [archiveReason] NVARCHAR(255),
    [version] INT NOT NULL CONSTRAINT [Tenant_version_df] DEFAULT 1,
    [createdById] NVARCHAR(64),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Tenant_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Tenant_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TenantActivity] (
    [id] NVARCHAR(64) NOT NULL,
    [tenantId] NVARCHAR(64) NOT NULL,
    [source] NVARCHAR(255) NOT NULL,
    [label] NVARCHAR(255),
    [externalRef] NVARCHAR(255),
    [occurredAt] DATETIME2 NOT NULL,
    [recordedBy] NVARCHAR(255),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TenantActivity_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [TenantActivity_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AuditEvent] (
    [id] NVARCHAR(64) NOT NULL,
    [actorId] NVARCHAR(64),
    [actorName] NVARCHAR(255) NOT NULL,
    [action] NVARCHAR(255) NOT NULL,
    [tenantId] NVARCHAR(64),
    [siteId] NVARCHAR(64),
    [summary] NVARCHAR(max) NOT NULL,
    [changes] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuditEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AuditEvent_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(255) NOT NULL,
    [email] NVARCHAR(255) NOT NULL,
    [entraObjectId] NVARCHAR(64),
    [identityProvider] NVARCHAR(255),
    [roleKey] NVARCHAR(255) NOT NULL CONSTRAINT [User_roleKey_df] DEFAULT 'viewer',
    [status] NVARCHAR(255) NOT NULL CONSTRAINT [User_status_df] DEFAULT 'active',
    [title] NVARCHAR(255),
    [avatarColor] NVARCHAR(255),
    [defaultLandingPage] NVARCHAR(255) NOT NULL CONSTRAINT [User_defaultLandingPage_df] DEFAULT '/review',
    [defaultSiteCode] NVARCHAR(255),
    [lastSignInAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[UserSite] (
    [userId] NVARCHAR(64) NOT NULL,
    [siteId] NVARCHAR(64) NOT NULL,
    CONSTRAINT [UserSite_pkey] PRIMARY KEY CLUSTERED ([userId],[siteId])
);

-- CreateTable
CREATE TABLE [dbo].[ApiKey] (
    [id] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(255) NOT NULL,
    [prefix] NVARCHAR(255) NOT NULL,
    [hash] NVARCHAR(64) NOT NULL,
    [scopes] NVARCHAR(255) NOT NULL,
    [siteId] NVARCHAR(64),
    [lastUsedAt] DATETIME2,
    [createdById] NVARCHAR(64),
    [revokedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ApiKey_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ApiKey_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ApiKey_hash_key] UNIQUE NONCLUSTERED ([hash])
);

-- CreateTable
CREATE TABLE [dbo].[Webhook] (
    [id] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(255) NOT NULL,
    [url] NVARCHAR(max) NOT NULL,
    [secret] NVARCHAR(255) NOT NULL,
    [events] NVARCHAR(255) NOT NULL CONSTRAINT [Webhook_events_df] DEFAULT '*',
    [active] BIT NOT NULL CONSTRAINT [Webhook_active_df] DEFAULT 1,
    [lastDeliveryAt] DATETIME2,
    [lastStatus] INT,
    [lastError] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Webhook_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Webhook_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[WebhookDelivery] (
    [id] NVARCHAR(64) NOT NULL,
    [webhookId] NVARCHAR(64) NOT NULL,
    [event] NVARCHAR(255) NOT NULL,
    [statusCode] INT,
    [error] NVARCHAR(max),
    [durationMs] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WebhookDelivery_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [WebhookDelivery_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Setting] (
    [key] NVARCHAR(255) NOT NULL,
    [value] NVARCHAR(255) NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Setting_pkey] PRIMARY KEY CLUSTERED ([key])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Site_entityName_idx] ON [dbo].[Site]([entityName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Tenant_siteId_status_attentionClockAt_idx] ON [dbo].[Tenant]([siteId], [status], [attentionClockAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Tenant_siteId_status_unit_idx] ON [dbo].[Tenant]([siteId], [status], [unit]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Tenant_updatedAt_idx] ON [dbo].[Tenant]([updatedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Tenant_lastName_firstName_idx] ON [dbo].[Tenant]([lastName], [firstName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TenantActivity_source_externalRef_idx] ON [dbo].[TenantActivity]([source], [externalRef]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TenantActivity_tenantId_occurredAt_idx] ON [dbo].[TenantActivity]([tenantId], [occurredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditEvent_createdAt_idx] ON [dbo].[AuditEvent]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditEvent_siteId_createdAt_idx] ON [dbo].[AuditEvent]([siteId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditEvent_tenantId_createdAt_idx] ON [dbo].[AuditEvent]([tenantId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_entraObjectId_idx] ON [dbo].[User]([entraObjectId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WebhookDelivery_webhookId_createdAt_idx] ON [dbo].[WebhookDelivery]([webhookId], [createdAt]);

-- AddForeignKey
ALTER TABLE [dbo].[Tenant] ADD CONSTRAINT [Tenant_siteId_fkey] FOREIGN KEY ([siteId]) REFERENCES [dbo].[Site]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[TenantActivity] ADD CONSTRAINT [TenantActivity_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AuditEvent] ADD CONSTRAINT [AuditEvent_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[UserSite] ADD CONSTRAINT [UserSite_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[UserSite] ADD CONSTRAINT [UserSite_siteId_fkey] FOREIGN KEY ([siteId]) REFERENCES [dbo].[Site]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ApiKey] ADD CONSTRAINT [ApiKey_siteId_fkey] FOREIGN KEY ([siteId]) REFERENCES [dbo].[Site]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[WebhookDelivery] ADD CONSTRAINT [WebhookDelivery_webhookId_fkey] FOREIGN KEY ([webhookId]) REFERENCES [dbo].[Webhook]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

