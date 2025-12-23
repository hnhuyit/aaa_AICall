// import supabase from '../utils/supabaseClient.js';

// export async function saveMessage(userId, newMessage) {
//   const { data: existing, error: selectError } = await supabase
//     .from('conversations')
//     .select('id, messages')
//     .eq('user_id', userId)
//     .single();

//   if (selectError && selectError.code !== 'PGRST116') {
//     console.error('Lỗi lấy hội thoại:', selectError.message);
//     return;
//   }

//   const messages = existing?.messages || [];
//   messages.push(newMessage);

//   if (existing) {
//     const { error: updateError } = await supabase
//       .from('conversations')
//       .update({ messages, updated_at: new Date().toISOString() })
//       .eq('id', existing.id);

//     if (updateError) {
//       console.error('Lỗi cập nhật hội thoại:', updateError.message);
//     }
//   } else {
//     const { error: insertError } = await supabase
//       .from('conversations')
//       .insert([{ user_id: userId, messages }]);

//     if (insertError) {
//       console.error('Lỗi thêm hội thoại:', insertError.message);
//     }
//   }
// }

// export async function getMessages(userId) {
//   const { data, error } = await supabase
//     .from('conversations')
//     .select('messages')
//     .eq('user_id', userId)
//     .single();

//   if (error) {
//     console.error('Lỗi khi lấy messages:', error.message);
//     return [];
//   }

//   return data?.messages || [];
// }
