export const sleep = async (time: number): Promise<number> => {
  return new Promise((res) => setTimeout(res, time))
}

