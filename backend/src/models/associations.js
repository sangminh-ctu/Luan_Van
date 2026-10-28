const Book = require('./Book');
const Category = require('./Category');
const Author = require('./Author');
const Publisher = require('./Publisher');
const Supplier = require('./Supplier');
const BookAuthor = require('./BookAuthor');
const BookImage = require('./BookImage');
const Inventory = require('./Inventory');
const StockReceipt = require('./StockReceipt');
const StockReceiptDetail = require('./StockReceiptDetail');
const User = require('./user.model');
const CartItem = require('./CartItem');
const Address = require('./Address');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Shipment = require('./Shipment');

// 1. Sách - Thể loại (N - 1)
Category.hasMany(Book, { foreignKey: 'category_id', as: 'books' });
Book.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

// 2. Sách - Nhà xuất bản (N - 1)
Publisher.hasMany(Book, { foreignKey: 'publisher_id', as: 'books' });
Book.belongsTo(Publisher, { foreignKey: 'publisher_id', as: 'publisher' });

// 2b. Sách - Nhà cung cấp (N - 1)
Supplier.hasMany(Book, { foreignKey: 'supplier_id', as: 'books' });
Book.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });

// 3. Sách - Tác giả (N - N thông qua BookAuthor)
Book.belongsToMany(Author, { 
    through: BookAuthor, 
    foreignKey: 'book_id', 
    otherKey: 'author_id',
    as: 'authors' 
});

Author.belongsToMany(Book, { 
    through: BookAuthor, 
    foreignKey: 'author_id', 
    otherKey: 'book_id',
    as: 'books'
});

// Quan hệ trực tiếp với bảng trung gian BookAuthor để dễ query vai trò (role)
Book.hasMany(BookAuthor, { foreignKey: 'book_id', as: 'book_authors' });
BookAuthor.belongsTo(Book, { foreignKey: 'book_id' });
Author.hasMany(BookAuthor, { foreignKey: 'author_id' });
BookAuthor.belongsTo(Author, { foreignKey: 'author_id', as: 'author' });

// 4. Sách - Hình ảnh (1 - N)
Book.hasMany(BookImage, { foreignKey: 'book_id', as: 'images' });
BookImage.belongsTo(Book, { foreignKey: 'book_id', as: 'book' });

// 5. Sách - Tồn kho (1 - 1)
Book.hasOne(Inventory, { foreignKey: 'book_id', as: 'inventory' });
Inventory.belongsTo(Book, { foreignKey: 'book_id', as: 'book' });

// 6. Phiếu nhập/xuất - Chi tiết phiếu (1 - N)
StockReceipt.hasMany(StockReceiptDetail, { foreignKey: 'receipt_id', as: 'details' });
StockReceiptDetail.belongsTo(StockReceipt, { foreignKey: 'receipt_id', as: 'receipt' });

// 6b. Nhà cung cấp - Phiếu nhập (1 - N)
Supplier.hasMany(StockReceipt, { foreignKey: 'supplier_id', as: 'receipts' });
StockReceipt.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });

// 7. Sách - Chi tiết phiếu nhập/xuất (1 - N)
Book.hasMany(StockReceiptDetail, { foreignKey: 'book_id', as: 'stock_receipt_details' });
StockReceiptDetail.belongsTo(Book, { foreignKey: 'book_id', as: 'book' });

// 8. Giỏ hàng - Người dùng & Sách
User.hasMany(CartItem, { foreignKey: 'user_id', as: 'cart_items' });
CartItem.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Book.hasMany(CartItem, { foreignKey: 'book_id', as: 'cart_items' });
CartItem.belongsTo(Book, { foreignKey: 'book_id', as: 'book' });

// 9. Sổ địa chỉ - Người dùng (N - 1)
User.hasMany(Address, { foreignKey: 'user_id', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 10. Đơn hàng - Người dùng, Địa chỉ, Chi tiết đơn & Vận chuyển
User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Address.hasMany(Order, { foreignKey: 'address_id', as: 'orders' });
Order.belongsTo(Address, { foreignKey: 'address_id', as: 'address' });

Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

Book.hasMany(OrderItem, { foreignKey: 'book_id', as: 'order_items' });
OrderItem.belongsTo(Book, { foreignKey: 'book_id', as: 'book' });

Order.hasOne(Shipment, { foreignKey: 'order_id', as: 'shipment' });
Shipment.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

module.exports = { 
    Book, 
    Category, 
    Author, 
    Publisher, 
    Supplier,
    BookAuthor, 
    BookImage, 
    Inventory,
    StockReceipt,
    StockReceiptDetail,
    User,
    CartItem,
    Address,
    Order,
    OrderItem,
    Shipment
};