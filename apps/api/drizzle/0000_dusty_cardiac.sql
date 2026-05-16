CREATE TABLE `AppSettings` (
	`Key` text PRIMARY KEY NOT NULL,
	`Value` text NOT NULL,
	`IsSecret` integer DEFAULT false NOT NULL,
	`UpdatedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `DocumentEventLink` (
	`EventId` integer NOT NULL,
	`DocumentId` integer NOT NULL,
	`CreatedDateTime` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`EventId`) REFERENCES `EventTable`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`DocumentId`) REFERENCES `DocumentTable`(`DocumentId`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DocumentEventLink_unique` ON `DocumentEventLink` (`EventId`,`DocumentId`);--> statement-breakpoint
CREATE TABLE `DocumentTable` (
	`DocumentId` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`Description` text(255) NOT NULL,
	`OriginalLink` text(1200),
	`StorageLink` text(1200),
	`ResourceType` text(100),
	`CreatedDateTime` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `EventTable` (
	`Id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`Name` text(255) NOT NULL,
	`StartDate` text NOT NULL,
	`EndDate` text,
	`Notes` text,
	`CreatedDateTime` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `EventTimelineLink` (
	`EventId` integer NOT NULL,
	`TimelineId` integer NOT NULL,
	`Description` text(60),
	`CreatedDateTime` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`EventId`) REFERENCES `EventTable`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`TimelineId`) REFERENCES `TimelineTable`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `EventTimelineLink_unique` ON `EventTimelineLink` (`EventId`,`TimelineId`);--> statement-breakpoint
CREATE TABLE `TagEventLink` (
	`EventId` integer NOT NULL,
	`TagId` integer NOT NULL,
	`CreatedDateTime` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`EventId`) REFERENCES `EventTable`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`TagId`) REFERENCES `TagTable`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `TagEventLink_unique` ON `TagEventLink` (`EventId`,`TagId`);--> statement-breakpoint
CREATE TABLE `TagTable` (
	`Id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`Name` text(40) NOT NULL,
	`Color` integer NOT NULL,
	`CreatedDateTime` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `TimelineTable` (
	`Id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`Name` text(60) NOT NULL,
	`Description` text(255),
	`SortIndex` integer DEFAULT 0,
	`CreatedDateTime` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `UserPreferences` (
	`Id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`TimelineId` integer,
	`Visible` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`TimelineId`) REFERENCES `TimelineTable`(`Id`) ON UPDATE no action ON DELETE cascade
);
