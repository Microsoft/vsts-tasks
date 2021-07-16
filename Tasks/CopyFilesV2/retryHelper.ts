/**
 * Interface for FindOptions
 * Contains properties to control whether to follow symlinks
 */
 export interface RetryOptions {

    /**
     * Number of retries
     */
    numberOfReties: number,

    /**
     * Timeout between retries in milliseconds
     */
    timeoutBetweenRetries: number
}

export class RetryHelper {
    private retryOptions: RetryOptions;

    constructor (retryOptions: RetryOptions) {
        this.retryOptions = retryOptions;
    }

    public async RunWithRetry(action: () => void): Promise<void> {
        let attempts: number = this.retryOptions.numberOfReties;
        while (true) {
            try {
                await action();
                break;
            } catch (err) {
                --attempts;
                console.log(`Error while ${action.name}: ${err}. Remaining attempts: ${attempts}`);
                if (attempts <= 0) {
                    throw err;
                }
                await this.sleep(); 
            }
        }
    }

    public async RunWithRetrySingleArg<T, A>(action: (stringValue: A) => T, firstArg: A): Promise<T>  {
        let attempts = this.retryOptions.numberOfReties;
        while (true) {
            try {
                const result: T = await action(firstArg);
                return result;
            } catch (err) {
                --attempts;
                console.log(`Error while ${action.name}: ${err}. Remaining attempts: ${attempts}`);
                if (attempts <= 0) {
                    throw err;
                }
                await this.sleep(); 
            }
        }
    }

    public async RunWithRetryMultiArgs<T, A, K>(action: (firstArg: A, secondArg: K) => T, firstArg: A, secondArg: K): Promise<T>  {
        let attempts = this.retryOptions.numberOfReties;
        while (true) {
            try {
                const result: T = await action(firstArg, secondArg);
                return result;
            } catch (err) {
                --attempts;
                console.log(`Error while ${action.name}: ${err}. Remaining attempts: ${attempts}`);
                if (attempts <= 0) {
                    throw err;
                }
                await this.sleep(); 
            }
        }
    }

    private async sleep() {
        return new Promise(resolve => setTimeout(resolve,
            this.retryOptions.timeoutBetweenRetries));
    }
}