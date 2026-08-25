import { supabase } from "./supabase";

const CACHE_PREFIX = "mrd-cache";

async function getCurrentUserId() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.user?.id || null;
  } catch (error) {
    console.error(
      "Offline cache user lookup error:",
      error
    );

    return null;
  }
}

export async function getOfflineCacheKey(moduleName) {
  const userId =
    await getCurrentUserId();

  if (!userId) {
    return null;
  }

  return `${CACHE_PREFIX}:${userId}:${moduleName}`;
}

export async function saveOfflineCache(
  moduleName,
  data
) {
  try {
    const cacheKey =
      await getOfflineCacheKey(
        moduleName
      );

    if (!cacheKey) {
      return null;
    }

    const savedAt =
      new Date().toISOString();

    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        data: Array.isArray(data)
          ? data
          : [],
        savedAt,
      })
    );

    return savedAt;
  } catch (error) {
    console.error(
      `${moduleName} cache save error:`,
      error
    );

    return null;
  }
}

export async function readOfflineCache(
  moduleName
) {
  try {
    const cacheKey =
      await getOfflineCacheKey(
        moduleName
      );

    if (!cacheKey) {
      return null;
    }

    const cached =
      localStorage.getItem(
        cacheKey
      );

    if (!cached) {
      return null;
    }

    const parsed =
      JSON.parse(cached);

    return {
      data: Array.isArray(parsed.data)
        ? parsed.data
        : [],
      savedAt:
        parsed.savedAt || null,
    };
  } catch (error) {
    console.error(
      `${moduleName} cache read error:`,
      error
    );

    return null;
  }
}

export async function clearCurrentUserOfflineCache() {
  try {
    const userId =
      await getCurrentUserId();

    if (!userId) {
      return;
    }

    const cachePrefix =
      `${CACHE_PREFIX}:${userId}:`;

    Object.keys(localStorage)
      .filter((key) =>
        key.startsWith(
          cachePrefix
        )
      )
      .forEach((key) =>
        localStorage.removeItem(
          key
        )
      );
  } catch (error) {
    console.error(
      "Offline cache cleanup error:",
      error
    );
  }
}
