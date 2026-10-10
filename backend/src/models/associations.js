const Book = require('./Book');
const Category = require('./Category');
const Author = require('./Author');
const BookAuthor = require('./BookAuthor');

// 1. Mối quan hệ giữa Sách (Book) và Danh mục (Category) [Nhiều - 1]
// Một Danh mục có nhiều Sách, Một Sách thuộc về Một Danh mục
Category.hasMany(Book, { foreignKey: 'category_id', as: 'books' });
Book.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

// 2. Mối quan hệ Nhiều - Nhiều giữa Sách và Tác giả thông qua bảng BookAuthor
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

// Xuất ra để dùng nếu cần
module.exports = { Book, Category, Author, BookAuthor };