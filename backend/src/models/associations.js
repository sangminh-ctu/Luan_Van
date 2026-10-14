const Book = require('./Book');
const Category = require('./Category');
const Author = require('./Author');
const Publisher = require('./Publisher');
const BookAuthor = require('./BookAuthor');
const BookImage = require('./BookImage');
const Inventory = require('./Inventory');
const StockReceipt = require('./StockReceipt');
const StockReceiptDetail = require('./StockReceiptDetail');

// 1. Sách - Thể loại (N - 1)
Category.hasMany(Book, { foreignKey: 'category_id', as: 'books' });
Book.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

// 2. Sách - Nhà xuất bản (N - 1)
Publisher.hasMany(Book, { foreignKey: 'publisher_id', as: 'books' });
Book.belongsTo(Publisher, { foreignKey: 'publisher_id', as: 'publisher' });

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

// 7. Sách - Chi tiết phiếu nhập/xuất (1 - N)
Book.hasMany(StockReceiptDetail, { foreignKey: 'book_id', as: 'stock_receipt_details' });
StockReceiptDetail.belongsTo(Book, { foreignKey: 'book_id', as: 'book' });

module.exports = { 
    Book, 
    Category, 
    Author, 
    Publisher, 
    BookAuthor, 
    BookImage, 
    Inventory,
    StockReceipt,
    StockReceiptDetail
};