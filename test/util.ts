export const sortKeys = (x: Iterable<[number, number]>) => [...x].sort((a, b) => a[0] - b[0])
export const concat = <T>(...items: T[][]): T[] => ([] as T[]).concat.apply([], items)

export const conditionalTest = (condition: boolean, ...args: ArgsType<typeof it>) =>
    condition ? it(...args) : it.skip(...args)
