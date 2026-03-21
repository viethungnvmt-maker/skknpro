export interface AppLoginUser {
  username: string;
  password: string;
  fullName?: string;
}

export const LOGIN_USERS_STORAGE_KEY = 'skkn_login_users_v1';
export const ACTIVE_LOGIN_USER_STORAGE_KEY = 'skkn_active_user_v1';

export const DEFAULT_LOGIN_USERS: AppLoginUser[] = [
  {
    username: 'VIETHUNG',
    password: '123456',
    fullName: 'VIETHUNG',
  },
];

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const normalizeUsername = (value: string) => value.trim().toUpperCase();

const normalizeLoginUser = (candidate: unknown): AppLoginUser | null => {
  if (!candidate || typeof candidate !== 'object') return null;

  const rawUser = candidate as Partial<AppLoginUser>;
  const username = typeof rawUser.username === 'string' ? normalizeUsername(rawUser.username) : '';
  const password = typeof rawUser.password === 'string' ? rawUser.password : '';
  const fullName = typeof rawUser.fullName === 'string' && rawUser.fullName.trim()
    ? rawUser.fullName.trim()
    : username;

  if (!username || !password) return null;

  return {
    username,
    password,
    fullName,
  };
};

const cloneDefaultUsers = () => DEFAULT_LOGIN_USERS.map((user) => ({ ...user }));

const mergeWithDefaultUsers = (users: AppLoginUser[]) => {
  const defaults = cloneDefaultUsers();
  const defaultUsernames = new Set(defaults.map((user) => normalizeUsername(user.username)));
  const extras = users.filter((user) => !defaultUsernames.has(normalizeUsername(user.username)));
  return [...defaults, ...extras];
};

export const loadLoginUsers = (): AppLoginUser[] => {
  const defaults = cloneDefaultUsers();

  if (!canUseStorage()) return defaults;

  const raw = window.localStorage.getItem(LOGIN_USERS_STORAGE_KEY);
  if (!raw) {
    window.localStorage.setItem(LOGIN_USERS_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Danh sach tai khoan khong hop le.');

    const sanitizedUsers = parsed
      .map((user) => normalizeLoginUser(user))
      .filter((user): user is AppLoginUser => user !== null);

    const mergedUsers = mergeWithDefaultUsers(sanitizedUsers);
    window.localStorage.setItem(LOGIN_USERS_STORAGE_KEY, JSON.stringify(mergedUsers));
    return mergedUsers;
  } catch {
    window.localStorage.setItem(LOGIN_USERS_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
};

export const findUserByUsername = (username: string, users: AppLoginUser[] = loadLoginUsers()) => {
  const normalizedUsername = normalizeUsername(username);
  return users.find((user) => normalizeUsername(user.username) === normalizedUsername) || null;
};

export const authenticateUser = (
  username: string,
  password: string,
  users: AppLoginUser[] = loadLoginUsers(),
) => {
  const matchedUser = findUserByUsername(username, users);
  if (!matchedUser) return null;
  return matchedUser.password === password ? matchedUser : null;
};
