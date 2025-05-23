import { fetchBooks, displayBooks, Book, saveBooks, removeBookCompletely, updateBookCopies, addBook, getAllUniqueGenres, displayUniqueGenres, searchBooksByTitleLogic, searchBooksByGenreLogic } from './books';
import { fetchUsers, displayUsers, User, addUser, removeUser, saveUsers, BorrowedBook } from './users';
import { borrowBook, returnBook, fetchBorrowedBooks, saveBorrowedBooks } from './module';
import * as readlineInterface from 'readline';
import Table from 'cli-table3';

let allBooks: Book[] = [];
let allUsers: User[] = [];
let allBorrowedBookRecords: BorrowedBook[] = [];
let dataLoaded = false;

async function loadAllData(): Promise<boolean> {
    if (!dataLoaded) {
        allBooks = await fetchBooks();
        allUsers = await fetchUsers();
        allBorrowedBookRecords = await fetchBorrowedBooks();
        dataLoaded = true;
        console.log("Initial book, user, and borrowed book data loaded.");
    }
    return true;
}

async function handleBorrowBook(rl: readlineInterface.Interface): Promise<boolean> {
    if (!dataLoaded) {
        await loadAllData();
    }

    rl.question("Enter User ID to borrow: ", (userIdStr: string) => {
        const userId = parseInt(userIdStr);
        const user = allUsers.find(u => u.user_id === userId);

        if (!user) {
            console.log("User not found.");
            displayMenu(rl);
            return true;
        }

        rl.question("Enter Book ID to borrow: ", async (bookIdStr: string) => {
            const bookId = parseInt(bookIdStr);
            const book = allBooks.find(b => b.id === bookId);

            if (!book) {
                console.log("Book not found.");
                displayMenu(rl);
                return true;
            }

            const [newBorrowedRecord, message] = borrowBook(user, book);
            console.log(message);
            if (newBorrowedRecord) {
                allBorrowedBookRecords.push(newBorrowedRecord);
                await saveUsers(allUsers);
                await saveBooks(allBooks);
                await saveBorrowedBooks(allBorrowedBookRecords);
            }
            displayMenu(rl);
        });
    });
    return true;
}

async function handleReturnBook(rl: readlineInterface.Interface): Promise<boolean> {
    if (!dataLoaded) {
        await loadAllData();
    }

    rl.question("Enter User ID returning the book: ", (userIdStr: string) => {
        const userId = parseInt(userIdStr);
        const user = allUsers.find(u => u.user_id === userId);

        if (!user) {
            console.log("User not found.");
            displayMenu(rl);
            return true;
        }

        const userActiveBorrows = allBorrowedBookRecords.filter(
            b => b.user_id === userId && !b.return_date
        );

        if (userActiveBorrows.length === 0) {
            console.log(`${user.name} has no active borrows to return.`);
            displayMenu(rl);
            return true;
        }

        console.log(`${user.name}'s actively borrowed books:`);
        userActiveBorrows.forEach(b => {
            const bookDetails = allBooks.find(book => book.id === b.book_id);
            console.log(`  - ID: ${b.book_id}, Title: ${bookDetails ? bookDetails.title : 'Unknown Title'}, Borrowed: ${b.borrow_date}`);
        });

        rl.question("Enter Book ID to return: ", async (bookIdStr: string) => {
            const bookId = parseInt(bookIdStr);
            
            const [updatedBorrowedRecords, message] = returnBook(allBorrowedBookRecords, userId, bookId, allBooks);
            console.log(message);
            if (updatedBorrowedRecords) {
                allBorrowedBookRecords = updatedBorrowedRecords;
                await saveBooks(allBooks);
                await saveBorrowedBooks(allBorrowedBookRecords);
            }
            displayMenu(rl);
        });
    });
    return true;
}

async function handleAddUser(rl: readlineInterface.Interface): Promise<boolean> {
    if (!dataLoaded) {
        await loadAllData();
    }
    rl.question("Enter new user's name: ", (name: string) => {
        rl.question("Enter new user's email: ", (email: string) => {
            rl.question("Enter new user's phone: ", (phone: string) => {
                rl.question("Enter new user's address: ", async (address: string) => {
                    const newUserDetails = { name, email, phone, address };
                    allUsers = addUser(allUsers, newUserDetails);
                    await saveUsers(allUsers);
                    console.log(`User "${name}" added successfully with ID ${allUsers[allUsers.length -1].user_id}.`);
                    displayMenu(rl);
                });
            });
        });
    });
    return true;
}

async function handleRemoveUser(rl: readlineInterface.Interface): Promise<boolean> {
    if (!dataLoaded) {
        await loadAllData();
    }
    rl.question("Enter User ID to remove: ", async (userIdStr: string) => {
        const userId = parseInt(userIdStr);
        if (isNaN(userId)) {
            console.log("Invalid User ID format.");
            displayMenu(rl);
            return true;
        }

        const [updatedUsers, userWasRemoved] = removeUser(allUsers, userId);
        if (userWasRemoved) {
            allUsers = updatedUsers;
            await saveUsers(allUsers);
            console.log(`User ID ${userId} removed successfully.`);
        } else {
            console.log(`User ID ${userId} not found.`);
        }
        displayMenu(rl);
    });
    return true;
}

const ONE_WEEK_IN_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

async function handleCheckOverdueBorrows(rl: readlineInterface.Interface): Promise<boolean> {
    if (!dataLoaded) {
        await loadAllData();
    }
    displayOverdueRecords(allBorrowedBookRecords, allUsers, allBooks);
    displayMenu(rl);
    return true;
}

async function handleCheckLateReturns(rl: readlineInterface.Interface): Promise<boolean> {
    if (!dataLoaded) {
        await loadAllData();
    }
    displayLateReturns(allBorrowedBookRecords, allUsers, allBooks);
    displayMenu(rl);
    return true;
}

async function handleRemoveBook(rl: readlineInterface.Interface): Promise<boolean> {
    if (!dataLoaded) {
        await loadAllData();
    }
    rl.question("Enter Book ID to remove completely: ", async (bookIdStr: string) => {
        const bookId = parseInt(bookIdStr);
        if (isNaN(bookId)) {
            console.log("Invalid Book ID format.");
            displayMenu(rl);
            return true;
        }

        const [updatedBooks, updatedBorrowedRecords, success, message] = removeBookCompletely(allBooks, allBorrowedBookRecords, bookId);
        console.log(message);

        if (success) {
            allBooks = updatedBooks;
            allBorrowedBookRecords = updatedBorrowedRecords;
            await saveBooks(allBooks);
            await saveBorrowedBooks(allBorrowedBookRecords);
        }
        displayMenu(rl);
    });
    return true;
}

async function handleAddBookCopies(rl: readlineInterface.Interface): Promise<boolean> {
    if (!dataLoaded) {
        await loadAllData();
    }
    rl.question("Enter Book ID to add copies to: ", (bookIdStr: string) => {
        const bookId = parseInt(bookIdStr);
        if (isNaN(bookId)) {
            console.log("Invalid Book ID format.");
            displayMenu(rl);
            return true;
        }
        rl.question("Enter number of copies to add: ", async (copiesStr: string) => {
            const copiesToAdd = parseInt(copiesStr);
            if (isNaN(copiesToAdd) || copiesToAdd <= 0) {
                console.log("Invalid number of copies. Must be a positive number.");
                displayMenu(rl);
                return true;
            }

            const [updatedBooks, message] = updateBookCopies(allBooks, bookId, copiesToAdd);
            console.log(message);

            if (updatedBooks) {
                allBooks = updatedBooks;
                await saveBooks(allBooks);
            }
            displayMenu(rl);
        });
    });
    return true;
}

async function handleRemoveBookCopies(rl: readlineInterface.Interface): Promise<boolean> {
    if (!dataLoaded) {
        await loadAllData();
    }
    rl.question("Enter Book ID to remove copies from: ", (bookIdStr: string) => {
        const bookId = parseInt(bookIdStr);
        if (isNaN(bookId)) {
            console.log("Invalid Book ID format.");
            displayMenu(rl);
            return true;
        }
        rl.question("Enter number of copies to remove: ", async (copiesStr: string) => {
            const copiesToRemove = parseInt(copiesStr);
            if (isNaN(copiesToRemove) || copiesToRemove <= 0) {
                console.log("Invalid number of copies. Must be a positive number.");
                displayMenu(rl);
                return true;
            }

            const [updatedBooks, message] = updateBookCopies(allBooks, bookId, -copiesToRemove); // Pass negative value
            console.log(message);

            if (updatedBooks) {
                allBooks = updatedBooks;
                await saveBooks(allBooks);
            }
            displayMenu(rl);
        });
    });
    return true;
}

async function handleAddBook(rl: readlineInterface.Interface): Promise<boolean> {
    if (!dataLoaded) {
        await loadAllData();
    }
    rl.question("Enter book title: ", (title: string) => {
        rl.question("Enter book author: ", (author: string) => {
            rl.question("Enter book genre(s) (comma-separated): ", (genreStr: string) => {
                const genre = genreStr.split(',').map(g => g.trim()).filter(g => g.length > 0);
                if (genre.length === 0) {
                    console.log("Invalid genre(s). At least one genre must be provided.");
                    displayMenu(rl);
                    return true;
                }
                rl.question("Enter published year: ", (publishedYearStr: string) => {
                    const published_year = parseInt(publishedYearStr);
                    if (isNaN(published_year)) {
                        console.log("Invalid published year.");
                        displayMenu(rl);
                        return true;
                    }
                    rl.question("Enter cover image URL: ", (cover_image: string) => {
                        rl.question("Enter edition count: ", (editionCountStr: string) => {
                            const edition_count = parseInt(editionCountStr);
                            if (isNaN(edition_count)) {
                                console.log("Invalid edition count.");
                                displayMenu(rl);
                                return true;
                            }
                            rl.question("Enter book description: ", (description: string) => {
                                rl.question("Enter number of copies: ", async (copiesStr: string) => {
                                    const copies = parseInt(copiesStr);
                                    if (isNaN(copies) || copies < 0) {
                                        console.log("Invalid number of copies.");
                                        displayMenu(rl);
                                        return true;
                                    }
                                    const newBookDetails = { title, author, genre, published_year, cover_image, edition_count, description, copies };
                                    allBooks = addBook(allBooks, newBookDetails);
                                    await saveBooks(allBooks);
                                    console.log(`Book "${title}" added successfully with ID ${allBooks[allBooks.length - 1].id}.`);
                                    displayMenu(rl);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
    return true;
}

async function handleDisplayBooks(): Promise<boolean> {
    if (!dataLoaded) {
        await loadAllData();
    }
    displayBooks(allBooks);
    return true;
}

async function handleDisplayUsers(): Promise<boolean> {
    if (!dataLoaded) {
        await loadAllData();
    }
    displayUsers(allUsers);
    return true;
}

function displayBorrowedRecords(records: BorrowedBook[], users: User[], books: Book[]): void {
    const table = new Table({
        head: ['User Name', 'Book Title', 'Borrow Date', 'Return Date'],
        colWidths: [22, 32, 17, 17],
        wordWrap: true,
        chars: {
            'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
            'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
            'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
            'right': '║', 'right-mid': '╢', 'middle': '│'
        },
        style: {
            head: ['cyan', 'bold'],
            border: ['grey'],
            'padding-left': 1,
            'padding-right': 1
        },
        colAligns: ['left', 'left', 'center', 'center']
    });

    records.forEach(record => {
        const user = users.find(u => u.user_id === record.user_id);
        const book = books.find(b => b.id === record.book_id);
        table.push([
            user ? user.name : 'Unknown',
            book ? book.title : 'Unknown',
            record.borrow_date,
            record.return_date || 'Not yet',
        ]);
    });

    console.log("\n╔═════════════════════════════════╗");
    console.log("║   ALL BORROWED BOOK RECORDS   ║");
    console.log("╚═════════════════════════════════╝");
    console.log(table.toString());
}

function displayOverdueRecords(records: BorrowedBook[], users: User[], books: Book[]): void {
    const table = new Table({
        head: ['User Name', 'Book Title', 'Borrow Date', 'Days Overdue'],
        colWidths: [22, 32, 17, 17],
        wordWrap: true,
        chars: {
            'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
            'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
            'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
            'right': '║', 'right-mid': '╢', 'middle': '│'
        },
        style: {
            head: ['cyan', 'bold'],
            border: ['grey'],
            'padding-left': 1,
            'padding-right': 1
        },
        colAligns: ['left', 'left', 'center', 'center']
    });

    const today = new Date();
    records.forEach(record => {
        if (!record.return_date) {
            const borrowDate = new Date(record.borrow_date);
            const timeDifference = today.getTime() - borrowDate.getTime();
            if (timeDifference > ONE_WEEK_IN_MILLISECONDS) {
                const user = users.find(u => u.user_id === record.user_id);
                const book = books.find(b => b.id === record.book_id);
                const daysOverdue = Math.floor(timeDifference / (1000 * 60 * 60 * 24)) - 7;
                table.push([
                    user ? user.name : 'Unknown',
                    book ? book.title : 'Unknown',
                    record.borrow_date,
                    daysOverdue,
                ]);
            }
        }
    });

    console.log("\n╔═════════════════════════════════════════════════════╗");
    console.log("║   USERS WITH OVERDUE BOOKS (Not returned after 1 week)   ║");
    console.log("╚═════════════════════════════════════════════════════╝");
    console.log(table.toString());
}

function displayLateReturns(records: BorrowedBook[], users: User[], books: Book[]): void {
    const table = new Table({
        head: ['User Name', 'Book Title', 'Borrow Date', 'Return Date', 'Days Late'],
        colWidths: [22, 32, 17, 17, 12],
        wordWrap: true,
        chars: {
            'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
            'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
            'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
            'right': '║', 'right-mid': '╢', 'middle': '│'
        },
        style: {
            head: ['cyan', 'bold'],
            border: ['grey'],
            'padding-left': 1,
            'padding-right': 1
        },
        colAligns: ['left', 'left', 'center', 'center', 'center']
    });

    records.forEach(record => {
        if (record.return_date) {
            const borrowDate = new Date(record.borrow_date);
            const returnDate = new Date(record.return_date);
            const timeDifference = returnDate.getTime() - borrowDate.getTime();
            if (timeDifference > ONE_WEEK_IN_MILLISECONDS) {
                const user = users.find(u => u.user_id === record.user_id);
                const book = books.find(b => b.id === record.book_id);
                const daysLate = Math.floor((timeDifference - ONE_WEEK_IN_MILLISECONDS) / (1000 * 60 * 60 * 24));
                table.push([
                    user ? user.name : 'Unknown',
                    book ? book.title : 'Unknown',
                    record.borrow_date,
                    record.return_date,
                    daysLate,
                ]);
            }
        }
    });

    console.log("\n╔═══════════════════════════════════════════════════╗");
    console.log("║   USERS WITH LATE RETURNS (Returned after 1 week)   ║");
    console.log("╚═══════════════════════════════════════════════════╝");
    console.log(table.toString());
}

async function handleDisplayAllGenres(rl: readlineInterface.Interface): Promise<boolean> {
    if (!dataLoaded) {
        await loadAllData();
    }
    const uniqueGenres = getAllUniqueGenres(allBooks);
    displayUniqueGenres(uniqueGenres);
    displayMenu(rl);
    return true;
}

async function handleSearchBooksByTitle(rl: readlineInterface.Interface): Promise<boolean> {
    if (!dataLoaded) {
        await loadAllData();
    }
    rl.question("Enter title to search: ", (searchTerm: string) => {
        const foundBooks = searchBooksByTitleLogic(allBooks, searchTerm);

        if (foundBooks.length > 0) {
            console.log(`\nFound ${foundBooks.length} book(s) matching "${searchTerm}":`);
            displayBooks(foundBooks);
        } else {
            console.log(`No books found matching "${searchTerm}".`);
        }
        displayMenu(rl);
    });
    return true;
}

async function handleSearchBooksByGenre(rl: readlineInterface.Interface): Promise<boolean> {
    if (!dataLoaded) {
        await loadAllData();
    }
    rl.question("Enter genre to search: ", (searchTerm: string) => {
        const foundBooks = searchBooksByGenreLogic(allBooks, searchTerm);

        if (foundBooks.length > 0) {
            console.log(`\nFound ${foundBooks.length} book(s) in genre "${searchTerm}":`);
            displayBooks(foundBooks);
        } else {
            console.log(`No books found in genre "${searchTerm}".`);
        }
        displayMenu(rl);
    });
    return true;
}

function displayMenu(rl: readlineInterface.Interface): boolean {
    console.log("\nLibrary Management System");
    console.log("1. Display list of books");
    console.log("2. Display list of users");
    console.log("3. Borrow a book");
    console.log("4. Return a book");
    console.log("5. Add a new user");
    console.log("6. Remove a user");
    console.log("7. Display all borrowed book records");
    console.log("8. Check Overdue Borrows (Not returned > 1 week)");
    console.log("9. Check Late Returns (Returned > 1 week)");
    console.log("10. Add a new book");
    console.log("11. Remove a Book from Library");
    console.log("12. Add Copies to a Book");
    console.log("13. Remove Copies from a Book");
    console.log("14. Display all genres");
    console.log("15. Search books by title");
    console.log("16. Search books by genre");
    console.log("17. Exit");
    rl.question("Enter your choice (1-17): ", async (choice: string) => {
        switch (choice) {
            case "1":
                await handleDisplayBooks();
                displayMenu(rl);
                break;
            case "2":
                await handleDisplayUsers();
                displayMenu(rl);
                break;
            case "3":
                await handleBorrowBook(rl);
                break;
            case "4":
                await handleReturnBook(rl);
                break;
            case "5":
                await handleAddUser(rl);
                break;
            case "6":
                await handleRemoveUser(rl);
                break;
            case "7":
                if (!dataLoaded) await loadAllData();
                displayBorrowedRecords(allBorrowedBookRecords, allUsers, allBooks);
                displayMenu(rl);
                break;
            case "8":
                if (!dataLoaded) await loadAllData();
                displayOverdueRecords(allBorrowedBookRecords, allUsers, allBooks);
                displayMenu(rl);
                break;
            case "9":
                if (!dataLoaded) await loadAllData();
                displayLateReturns(allBorrowedBookRecords, allUsers, allBooks);
                displayMenu(rl);
                break;
            case "10":
                await handleAddBook(rl);
                break;
            case "11":
                await handleRemoveBook(rl);
                break;
            case "12":
                await handleAddBookCopies(rl);
                break;
            case "13":
                await handleRemoveBookCopies(rl);
                break;
            case "14":
                await handleDisplayAllGenres(rl);
                break;
            case "15":
                await handleSearchBooksByTitle(rl);
                break;
            case "16":
                await handleSearchBooksByGenre(rl);
                break;
            case "17":
                console.log("Exiting...");
                rl.close();
                break;
            default:
                console.log("Invalid choice. Please try again.");
                displayMenu(rl);
        }
    });
    return true;
}

function showMenu(): boolean {
    const rl = readlineInterface.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    displayMenu(rl);
    return true;
}

showMenu();