interface User {
  id: number;
  name: string;
  email: string;
}

class UserService {
  private users: User[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ];

  getAllUsers(): User[] {
    return this.users;
  }

  getUserById(id: number): User | undefined {
    return this.users.find(user => user.id === id);
  }

  addUser(user: Omit<User, 'id'>): User {
    const newUser: User = {
      id: Math.max(...this.users.map(u => u.id)) + 1,
      ...user
    };
    this.users.push(newUser);
    return newUser;
  }
}

// Export for testing
export { UserService, User };

// Simple demonstration
if (require.main === module) {
  const userService = new UserService();
  console.log('Users:', userService.getAllUsers());
  
  const newUser = userService.addUser({ name: 'Test User', email: 'test@example.com' });
  console.log('Added user:', newUser);
  
  console.log('All users after addition:', userService.getAllUsers());
}