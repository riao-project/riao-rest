# @riao/rest

Build production-ready REST APIs in minutes with pre-configured CRUD endpoints and intelligent routing.

## Features

- **Ready-to-use CRUD endpoints** - Create, read, update, and delete operations out of the box
- **Type-safe** - Full TypeScript support with generic types
- **Database agnostic** - Works with any database through [@riao/dbal](https://github.com/riao-project/riao-dbal)
- **Built-in validation** - Integrate [valsan](https://github.com/riao-project/valsan) validators seamlessly
- **Self-documenting** - Automatically servers Swagger/OpenAPI docs from your code
- **Flexible & extensible** - Override any behavior to match your requirements
- **Error handling** - Standard REST error responses included

## Installation

```bash
npm install @riao/rest api-machine valsan
```

## Requirements

- Node.js 18+
- [@riao/dbal](https://github.com/riao-project/riao-dbal)

## Quick Start

`src/users.ts`
```typescript
import { RestServer } from 'api-machine';
import {
    RiaoRouter,
    RiaoCreateEndpoint,
    RiaoGetListEndpoint, 
    RiaoGetOneEndpoint,
    RiaoUpdateEndpoint,
    RiaoDeleteEndpoint
} from 'riao-rest';
import { ObjectSanitizer, LengthValidator } from 'valsan';

import { maindb } from '../database/main';

// Define your model
interface User {
  id: string;
  name: string;
  email: string;
}

const userRepo = maindb.getQueryRepository<User>({
    table: 'users',
});

const userValidators = {
    id: new ComposedValSan([
        new LengthValidator({ min: 1, max: 36 })
    ]),
    name: new ComposedValSan([
	    new TrimSanitizer(),
	    new LengthValidator({ minLength: 1, maxLength: 100 }),
    ]),
    email: new ComposedValSan([
        new TrimSanitizer(),
        new LengthValidator({ minLength: 10, maxLength: 100 }),
        new EmailValidator(),
    ])
};

// Create endpoints by extending base classes
class CreateUserEndpoint extends RiaoCreateEndpoint<User> {
  override body = new ObjectSanitizer({
    name: userValidators.name,
    email: userValidators.email,
  });

  override response = new ObjectSanitizer({
    id: userValidators.id
  })
}

class ListUsersEndpoint extends RiaoGetListEndpoint<User> {}

class GetUserEndpoint extends RiaoGetOneEndpoint<User> {
    override params = new ObjectSanitizer({
        id: userValidators.id
    });
}

class UpdateUserEndpoint extends RiaoUpdateEndpoint<User> {
    override params = new ObjectSanitizer({
        id: userValidators.id
    });

    override body = new ObjectSanitizer({
        name: userValidation.name.copy({ isOptional: true }),
        email: userValidation.email.copy({ isOptional: true })
    })
}

class DeleteUserEndpoint extends RiaoDeleteEndpoint<User> {
    override params = new ObjectSanitizer({
        id: userValidators.id
    });
}

// Set up the router
class UsersRouter extends RiaoRouter<User> {
  override repo = yourDatabaseRepository;
  override path = '/users';

  protected override async routes() {
    return [
      CreateUserEndpoint,
      GetUserEndpoint,
      ListUsersEndpoint,
      UpdateUserEndpoint,
      DeleteUserEndpoint,
    ];
  }
}

// Start the server
class Server extends RestServer {
  override router = UsersRouter;
}
```

This creates a fully functional REST API with the following endpoints:

- `POST /users` - Create a user
- `GET /users` - List all users
- `GET /users/:id` - Get a specific user
- `PUT /users/:id` - Update a user
- `DELETE /users/:id` - Delete a user

## Available Endpoints

### RiaoCreateEndpoint

Creates new records with automatic validation and conflict checking.

```typescript
class CreateEndpoint extends RiaoCreateEndpoint<YourModel> {
  override body = new ObjectSanitizer({ /* validators */ });
  
  // Optional: Check for conflicts before creating
  override async checkConflict(request: ApiRequest): Promise<void> {
    // Your conflict logic
  }
}
```

### RiaoGetListEndpoint

Retrieves all records from the database.

```typescript
class ListEndpoint extends RiaoGetListEndpoint<YourModel> {}
```

### RiaoGetOneEndpoint

Retrieves a single record by ID with automatic 404 handling.

```typescript
class GetEndpoint extends RiaoGetOneEndpoint<YourModel> {
  override params = new ObjectSanitizer({ /* validators */ });
}
```

### RiaoUpdateEndpoint

Updates existing records with partial data support.

```typescript
class UpdateEndpoint extends RiaoUpdateEndpoint<YourModel> {
  override params = new ObjectSanitizer({ /* validators */ });
  override body = new ObjectSanitizer({ /* validators */ });
}
```

### RiaoDeleteEndpoint

Deletes records by ID.

```typescript
class DeleteEndpoint extends RiaoDeleteEndpoint<YourModel> {
  override params = new ObjectSanitizer({ /* validators */ });
}
```

## RiaoRouter

The router manages your endpoints and injects the database repository.

```typescript
class YourRouter extends RiaoRouter<YourModel> {
  override repo = yourRepository;
  override path = '/your-path';

  protected override async routes() {
    return [
      /* Your endpoint classes */
    ];
  }
}
```

## Customization

Every endpoint can be customized by overriding methods:

```typescript
class CustomCreateEndpoint extends RiaoCreateEndpoint<User> {
  // Custom path
  override path = '/custom-path';
  
  // Custom status code
  override statusCode = 201;
  
  // Custom description for API docs
  override description = 'Create a new user';
  
  // Add custom error types
  override getErrors() {
    return {
      ...super.getErrors(),
      conflict: new ConflictError('User already exists'),
    };
  }
  
  // Override the main handler
  override async handle(request, response, next) {
    // Your custom logic
  }
}
```

## Contributing & Development

See [contributing.md](docs/contributing/contributing.md) for information on how to develop or contribute to this project!
