export class AppError extends Error{
    statusCode:number;
    isOperational:boolean;


    constructor(message:string, statusCode:number){
        super(message);
        this.statusCode=statusCode;
        this.isOperational=true;
        Object.setPrototypeOf(this, new.target.prototype)
    }

}


export class BadRequestError extends AppError{
    constructor(message="Bad request"){
        super(message,400);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message="Unauthorized"){
        super(message, 401)
    }
}

export class NotFoundError extends AppError{
    constructor(message="Not found"){
        super(message, 404);
    }
}

export class ConflictError extends AppError{
    constructor(message="Conflict"){
        super(message, 409)
    }
}