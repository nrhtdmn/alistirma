import type { User, UserRole } from '../types';

/** İçerik oluşturma / düzenleme / silme yetkisi */
export function canManageContent(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'ogretmen' || user.role === 'diger';
}

/** Kullanıcı yönetimi, ayarlar (yedek silme vb.) */
export function canManageSystem(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'ogretmen' || user.role === 'diger';
}

/** Sınav ataması yapabilir */
export function canAssign(user: User | null): boolean {
  return user?.role === 'ogretmen' || user?.role === 'diger';
}

export function isStudent(user: User | null): boolean {
  return user?.role === 'ogrenci';
}

export function isParent(user: User | null): boolean {
  return user?.role === 'veli';
}

/** Öğrenci ve veli düzenleme menülerine giremez */
export function isReadOnlyRole(user: User | null): boolean {
  return isStudent(user) || isParent(user);
}

export const EDIT_ROLES: UserRole[] = ['ogretmen', 'diger'];
