-- ============================================================
-- CoWork Database Schema & Seed Data
-- Drop-and-recreate style — safe to re-run
-- ============================================================

-- Drop dependent tables first (reverse dependency order)
IF OBJECT_ID('dbo.OrderItems', 'U') IS NOT NULL DROP TABLE dbo.OrderItems;
IF OBJECT_ID('dbo.Payments', 'U') IS NOT NULL DROP TABLE dbo.Payments;
IF OBJECT_ID('dbo.CartItems', 'U') IS NOT NULL DROP TABLE dbo.CartItems;
IF OBJECT_ID('dbo.MenuItemLikes', 'U') IS NOT NULL DROP TABLE dbo.MenuItemLikes;
IF OBJECT_ID('dbo.Orders', 'U') IS NOT NULL DROP TABLE dbo.Orders;
IF OBJECT_ID('dbo.Complaints', 'U') IS NOT NULL DROP TABLE dbo.Complaints;
IF OBJECT_ID('dbo.Feedback', 'U') IS NOT NULL DROP TABLE dbo.Feedback;
IF OBJECT_ID('dbo.Inspections', 'U') IS NOT NULL DROP TABLE dbo.Inspections;
IF OBJECT_ID('dbo.MenuItems', 'U') IS NOT NULL DROP TABLE dbo.MenuItems;
IF OBJECT_ID('dbo.Stalls', 'U') IS NOT NULL DROP TABLE dbo.Stalls;
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL DROP TABLE dbo.Users;

-- ============================================================
-- Users
-- ============================================================
CREATE TABLE dbo.Users (
    UserId      INT IDENTITY(1,1) PRIMARY KEY,
    Username    NVARCHAR(50)  NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    Email       NVARCHAR(255) NOT NULL,
    FullName    NVARCHAR(100) NOT NULL,
    Role        NVARCHAR(20)  NOT NULL CHECK (Role IN ('customer', 'stallOwner')),
    CreatedAt   DATETIME      NOT NULL DEFAULT GETDATE()
);

-- ============================================================
-- Stalls
-- ============================================================
CREATE TABLE dbo.Stalls (
    StallId     INT IDENTITY(1,1) PRIMARY KEY,
    OwnerId     INT           NOT NULL,
    StallName   NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NULL,
    CuisineType NVARCHAR(50)  NOT NULL,
    Status      NVARCHAR(10)  NOT NULL DEFAULT 'open' CHECK (Status IN ('open', 'closed')),
    CONSTRAINT FK_Stalls_Owner FOREIGN KEY (OwnerId) REFERENCES dbo.Users(UserId)
);

-- ============================================================
-- MenuItems
-- ============================================================
CREATE TABLE dbo.MenuItems (
    MenuItemId  INT IDENTITY(1,1) PRIMARY KEY,
    StallId     INT            NOT NULL,
    Name        NVARCHAR(100)  NOT NULL,
    Description NVARCHAR(500)  NULL,
    Price       DECIMAL(10,2)  NOT NULL,
    IsAvailable BIT            NOT NULL DEFAULT 1,
    LikeCount   INT            NOT NULL DEFAULT 0,
    CONSTRAINT FK_MenuItems_Stall FOREIGN KEY (StallId) REFERENCES dbo.Stalls(StallId)
);

-- ============================================================
-- MenuItemLikes
-- ============================================================
CREATE TABLE dbo.MenuItemLikes (
    UserId     INT NOT NULL,
    MenuItemId INT NOT NULL,
    PRIMARY KEY (UserId, MenuItemId),
    CONSTRAINT FK_Likes_User FOREIGN KEY (UserId)     REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_Likes_Item FOREIGN KEY (MenuItemId) REFERENCES dbo.MenuItems(MenuItemId)
);

-- ============================================================
-- CartItems
-- ============================================================
CREATE TABLE dbo.CartItems (
    CartItemId INT IDENTITY(1,1) PRIMARY KEY,
    UserId     INT NOT NULL,
    MenuItemId INT NOT NULL,
    Quantity   INT NOT NULL DEFAULT 1,
    CONSTRAINT UQ_Cart_User_Item UNIQUE (UserId, MenuItemId),
    CONSTRAINT FK_Cart_User FOREIGN KEY (UserId)     REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_Cart_Item FOREIGN KEY (MenuItemId) REFERENCES dbo.MenuItems(MenuItemId)
);

-- ============================================================
-- Orders
-- ============================================================
CREATE TABLE dbo.Orders (
    OrderId         INT IDENTITY(1,1) PRIMARY KEY,
    UserId          INT           NULL,
    Subtotal        DECIMAL(10,2) NOT NULL,
    PackagingFee    DECIMAL(10,2) NOT NULL DEFAULT 0,
    DeliveryFee     DECIMAL(10,2) NOT NULL DEFAULT 0,
    Total           DECIMAL(10,2) NOT NULL,
    Status          NVARCHAR(20)  NOT NULL DEFAULT 'Pending'
                    CHECK (Status IN ('Pending','Paid','Preparing','Ready','Completed')),
    EstReadyMinutes INT           NULL,
    CreatedAt       DATETIME      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Orders_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId)
);

-- ============================================================
-- OrderItems (name/price snapshot)
-- ============================================================
CREATE TABLE dbo.OrderItems (
    OrderItemId INT IDENTITY(1,1) PRIMARY KEY,
    OrderId     INT            NOT NULL,
    MenuItemId  INT            NOT NULL,
    StallId     INT            NOT NULL,
    ItemName    NVARCHAR(100)  NOT NULL,
    UnitPrice   DECIMAL(10,2)  NOT NULL,
    Quantity    INT            NOT NULL DEFAULT 1,
    CONSTRAINT FK_OrderItems_Order FOREIGN KEY (OrderId)    REFERENCES dbo.Orders(OrderId),
    CONSTRAINT FK_OrderItems_Item  FOREIGN KEY (MenuItemId) REFERENCES dbo.MenuItems(MenuItemId),
    CONSTRAINT FK_OrderItems_Stall FOREIGN KEY (StallId)    REFERENCES dbo.Stalls(StallId)
);

-- ============================================================
-- Payments
-- ============================================================
CREATE TABLE dbo.Payments (
    PaymentId INT IDENTITY(1,1) PRIMARY KEY,
    OrderId   INT           NOT NULL,
    Amount    DECIMAL(10,2) NOT NULL,
    Method    NVARCHAR(50)  NOT NULL,
    Status    NVARCHAR(10)  NOT NULL CHECK (Status IN ('Success', 'Failed')),
    PaidAt    DATETIME      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Payments_Order FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId)
);

-- ============================================================
-- Feedback
-- ============================================================
CREATE TABLE dbo.Feedback (
    FeedbackId INT IDENTITY(1,1) PRIMARY KEY,
    StallId    INT            NOT NULL,
    UserId     INT            NULL,
    Rating     INT            NOT NULL CHECK (Rating BETWEEN 1 AND 5),
    Comment    NVARCHAR(1000) NOT NULL,
    CreatedAt  DATETIME       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Feedback_Stall FOREIGN KEY (StallId) REFERENCES dbo.Stalls(StallId),
    CONSTRAINT FK_Feedback_User  FOREIGN KEY (UserId)  REFERENCES dbo.Users(UserId)
);

-- ============================================================
-- Complaints
-- ============================================================
CREATE TABLE dbo.Complaints (
    ComplaintId INT IDENTITY(1,1) PRIMARY KEY,
    StallId     INT            NOT NULL,
    UserId      INT            NULL,
    Category    NVARCHAR(50)   NOT NULL,
    Description NVARCHAR(1000) NOT NULL,
    Status      NVARCHAR(10)   NOT NULL DEFAULT 'Open' CHECK (Status IN ('Open', 'Resolved')),
    CreatedAt   DATETIME       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Complaints_Stall FOREIGN KEY (StallId) REFERENCES dbo.Stalls(StallId),
    CONSTRAINT FK_Complaints_User  FOREIGN KEY (UserId)  REFERENCES dbo.Users(UserId)
);

-- ============================================================
-- Inspections
-- ============================================================
CREATE TABLE dbo.Inspections (
    InspectionId     INT IDENTITY(1,1) PRIMARY KEY,
    StallId          INT          NOT NULL,
    InspectionDate   DATE         NOT NULL,
    Score            INT          NOT NULL,
    Grade            NCHAR(1)     NOT NULL CHECK (Grade IN ('A','B','C','D')),
    ViolationCategory NVARCHAR(100) NULL,
    Notes            NVARCHAR(500) NULL,
    CONSTRAINT FK_Inspections_Stall FOREIGN KEY (StallId) REFERENCES dbo.Stalls(StallId)
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Users (bcrypt hash for "password" used as placeholder)
INSERT INTO dbo.Users (Username, PasswordHash, Email, FullName, Role) VALUES
('ahmad88',   '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'ahmad@cowork.com',   'Ahmad bin Ismail', 'stallOwner'),
('meiling',   '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'meiling@cowork.com',  'Tan Mei Ling',     'stallOwner'),
('kumar_s',   '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'kumar@cowork.com',    'Siva Kumar',       'stallOwner'),
('jane_doe',  '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'jane@example.com',    'Jane Doe',         'customer'),
('bob_tan',   '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'bob@example.com',     'Bob Tan',          'customer');

-- Stalls
INSERT INTO dbo.Stalls (OwnerId, StallName, Description, CuisineType, Status) VALUES
(1, 'Roti John Express', 'Authentic Roti John with a crispy twist — a local favourite since 2008.', 'Malay', 'open'),
(2, 'Wok & Roll',        'Sizzling wok-fried noodles and classic Chinese hawker dishes.',           'Chinese', 'open'),
(3, 'Spice Garden',      'Home-style Indian curries, biryanis, and tandoori delights.',             'Indian', 'open');

-- Menu Items — Roti John Express (Stall 1)
INSERT INTO dbo.MenuItems (StallId, Name, Description, Price, IsAvailable, LikeCount) VALUES
(1, 'Classic Roti John',        'Toasted baguette with minced mutton, egg, and special sauce',          6.50, 1, 24),
(1, 'Chicken Roti John',        'Crispy baguette layered with spiced chicken and onion-egg scramble',    6.00, 1, 18),
(1, 'Cheese Roti John',         'The classic with a generous blanket of melted cheddar',                 7.50, 1, 31),
(1, 'Mutton Kebab Wrap',        'Grilled spiced mutton skewers wrapped in flatbread with mint chutney',  8.00, 1, 15),
(1, 'Curry Puff (2 pcs)',       'Flaky pastry filled with curried potato and chicken',                   3.50, 1, 12),
(1, 'Teh Tarik',                'Frothy pulled milk tea — hot or iced',                                  2.50, 1, 9);

-- Menu Items — Wok & Roll (Stall 2)
INSERT INTO dbo.MenuItems (StallId, Name, Description, Price, IsAvailable, LikeCount) VALUES
(2, 'Char Kway Teow',           'Flat rice noodles wok-fried with prawns, cockles, and dark soy',        7.00, 1, 42),
(2, 'Hokkien Mee',              'Thick yellow noodles braised in rich prawn broth with pork belly',       7.50, 1, 35),
(2, 'Sweet & Sour Chicken Rice', 'Crispy battered chicken in tangy sauce over steamed jasmine rice',      6.50, 1, 20),
(2, 'Wonton Noodle Soup',       'Springy egg noodles in clear broth with handmade prawn wontons',         6.00, 1, 28),
(2, 'Spring Rolls (4 pcs)',     'Crispy vegetable spring rolls with sweet chilli dip',                    3.00, 1, 16),
(2, 'Iced Lemon Tea',           'Freshly brewed Ceylon tea with lemon and a hint of honey',               2.00, 1, 11);

-- Menu Items — Spice Garden (Stall 3)
INSERT INTO dbo.MenuItems (StallId, Name, Description, Price, IsAvailable, LikeCount) VALUES
(3, 'Chicken Biryani',          'Fragrant basmati rice layered with marinated chicken and saffron',       9.00, 1, 38),
(3, 'Butter Chicken',           'Tandoori chicken simmered in creamy tomato-butter gravy',                8.50, 1, 45),
(3, 'Garlic Naan',              'Soft leavened flatbread brushed with garlic butter',                     2.50, 1, 22),
(3, 'Vegetable Samosa (3 pcs)', 'Crispy triangular pastry stuffed with spiced potato and green peas',     4.00, 1, 19),
(3, 'Mango Lassi',              'Creamy yogurt drink blended with Alphonso mango pulp',                   3.50, 1, 27),
(3, 'Masala Chai',             'Spiced Indian milk tea brewed with cardamom, ginger, and cloves',         2.00, 1, 14);

-- Inspections — Roti John Express (Stall 1)
INSERT INTO dbo.Inspections (StallId, InspectionDate, Score, Grade, ViolationCategory, Notes) VALUES
(1, '2026-01-15', 95, 'A', NULL,              'All stations clean, food stored at correct temperatures.'),
(1, '2026-02-28', 88, 'B', 'Minor — Storage', 'Dry goods stored on floor in back area. Corrected on site.'),
(1, '2026-04-10', 92, 'A', NULL,              'No violations. Staff hygiene practices excellent.'),
(1, '2026-05-22', 85, 'B', 'Cleaning',        'Hood filters require more frequent degreasing. Follow-up in 2 weeks.'),
(1, '2026-06-30', 94, 'A', NULL,              'Previous issue resolved. Kitchen in great condition.');

-- Inspections — Wok & Roll (Stall 2)
INSERT INTO dbo.Inspections (StallId, InspectionDate, Score, Grade, ViolationCategory, Notes) VALUES
(2, '2026-01-20', 90, 'A', NULL,               'Clean and well-organised kitchen.'),
(2, '2026-03-05', 76, 'C', 'Pest / Storage',   'Evidence of pests in dry storage. Mandatory pest control ordered.'),
(2, '2026-04-18', 82, 'B', 'Cleaning',          'Pest issue resolved. Some utensils need deeper cleaning.'),
(2, '2026-05-30', 88, 'B', NULL,                'Improving — minor wiping-cloth sanitation issue noted.'),
(2, '2026-06-25', 91, 'A', NULL,                'All prior violations cleared. Good overall compliance.');

-- Inspections — Spice Garden (Stall 3)
INSERT INTO dbo.Inspections (StallId, InspectionDate, Score, Grade, ViolationCategory, Notes) VALUES
(3, '2026-01-10', 91, 'A', NULL,                     'Well-maintained. Spice storage properly labelled.'),
(3, '2026-02-25', 84, 'B', 'Temperature / Storage',   'Walk-in chiller at 6°C (must be ≤4°C). Adjusted on the spot.'),
(3, '2026-04-02', 79, 'C', 'Hygiene',                 'Food handler without hair restraint. Staff retraining required.'),
(3, '2026-05-18', 87, 'B', 'Temperature',              'Chiller back in range. Minor labelling gaps on prepped containers.'),
(3, '2026-06-20', 93, 'A', NULL,                       'Excellent turnaround. All documentation and hygiene on point.');
