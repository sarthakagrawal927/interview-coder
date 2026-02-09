import { createContext, useContext, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import type { InterviewCategory } from '../types';

interface CategoryContextType {
  category: InterviewCategory;
}

const CategoryContext = createContext<CategoryContextType>({ category: 'dsa' });

export function CategoryProvider({ children }: { children: ReactNode }) {
  const { category } = useParams<{ category: string }>();
  const validCategory = (['dsa', 'lld', 'hld', 'behavioral'].includes(category || '')
    ? category
    : 'dsa') as InterviewCategory;

  return (
    <CategoryContext.Provider value={{ category: validCategory }}>
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategory() {
  return useContext(CategoryContext);
}
