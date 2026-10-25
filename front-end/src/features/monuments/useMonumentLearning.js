import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getMonumentLearning, setMonumentFavorite, completeMonumentTour } from '../../api/monuments';

export default function useMonumentLearning() {
  const {user} = useAuth();
  const client = useQueryClient();
  const key = ['monument-learning',user?.id];
  const query = useQuery({queryKey:key,queryFn:({signal})=>getMonumentLearning(signal,user.id),enabled:!!user?.id,staleTime:15000});
  const favorite = useMutation({
    mutationKey:[...key,'favorite'],mutationFn:variables=>setMonumentFavorite({...variables,accountId:user.id}),
    onSuccess:async(record,variables)=>{
      await client.cancelQueries({queryKey:key,exact:true});
      if (!client.getQueryData(key)) {await client.invalidateQueries({queryKey:key,exact:true});return;}
      client.setQueryData(key,old=>({
        favorites:[...old.favorites.filter(r=>r.monument_id!==variables.monumentId),...(variables.saved?[record]:[])],
        completions:old.completions,
      }));
    },
  });
  const tour = useMutation({
    mutationKey:[...key,'tour'],mutationFn:variables=>completeMonumentTour({...variables,accountId:user.id}),
    onSuccess:async record=>{
      await client.cancelQueries({queryKey:key,exact:true});
      if (!client.getQueryData(key)) {await client.invalidateQueries({queryKey:key,exact:true});return;}
      client.setQueryData(key,old=>({
        favorites:old.favorites,
        completions:[...old.completions.filter(r=>r.monument_id!==record.monument_id || r.tour_revision!==record.tour_revision),record],
      }));
    },
  });
  return {...query,favorite,tour,favorites:query.data?.favorites||[],completions:query.data?.completions||[],ready:query.isSuccess};
}
